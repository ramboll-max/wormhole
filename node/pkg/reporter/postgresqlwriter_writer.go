package reporter

import (
	"database/sql"
	"database/sql/driver"
	"encoding/base64"
	"fmt"
	"github.com/certusone/wormhole/node/pkg/vaa"
	"reflect"
	"strconv"
	"strings"
)

const maxAllowedUInt64 = 1<<63 - 1

func (w *postgreSqlWriter) CleanTransaction(tx *sql.Tx) {
	err := tx.Rollback()
	if err != nil && err != sql.ErrTxDone {
		w.logger.Error("Failed to rollback transaction: " + err.Error())
	}
}

func (w *postgreSqlWriter) ConvertValue(v interface{}) driver.Value {
	if driver.IsValue(v) {
		return v
	}

	rv := reflect.ValueOf(v)
	switch rv.Kind() {
	case reflect.Ptr:
		// indirect pointers
		if rv.IsNil() {
			return nil
		}
		return w.ConvertValue(rv.Elem().Interface())
	case reflect.Uint64:
		u64 := rv.Uint()
		if u64 > maxAllowedUInt64 {
			s := strconv.FormatUint(u64, 10)
			bytes := []byte(s)
			return bytes
		}
		// default behaviour to convert uint64 to int64
		return int64(u64)
	}

	res, err := driver.DefaultParameterConverter.ConvertValue(v)
	if err != nil {
		w.logger.Fatal("Failed to convert value: " + err.Error())
		return nil
	}
	return res
}

func (w *postgreSqlWriter) writeTokenTransfer(tx *sql.Tx, tokenTransfer *TokenTransferPayload) (tableId int64, err error) {
	builder := strings.Builder{}
	builder.WriteString("insert into ")
	builder.WriteString(w.dbCfg.Schema)
	builder.WriteString(".")
	builder.WriteString(TableNamePayloadTokenTransfer)
	builder.WriteString("(payload_id, amount, origin_address, origin_chain, target_address, target_chain")
	switch tokenTransfer.GetPayloadID() {
	case TokenTransferPayloadID:
		builder.WriteString(", fee, create_time) values ($1,$2,$3,$4,$5,$6,$7,now()) RETURNING id")
		exec := builder.String()
		row := tx.QueryRowContext(w.ctx, exec,
			tokenTransfer.PayloadID,
			tokenTransfer.Amount.String(),
			tokenTransfer.TokenAddress.String(),
			tokenTransfer.TokenChain,
			tokenTransfer.TargetAddress.String(),
			tokenTransfer.TargetChain,
			tokenTransfer.Fee.String(),
		)
		err = row.Scan(&tableId)
		if err != nil {
			return 0, fmt.Errorf("failed to insert token_transfer: %w", err)
		}
		return
	case TokenTransferWithPayloadPayloadID:
		builder.WriteString(", from_address, payload, create_time) values ($1,$2,$3,$4,$5,$6,$7,$8,now())")
		builder.WriteString(" RETURNING id")
		exec := builder.String()
		row := tx.QueryRowContext(w.ctx, exec,
			tokenTransfer.PayloadID,
			tokenTransfer.Amount.String(),
			tokenTransfer.TokenAddress.String(),
			tokenTransfer.TokenChain,
			tokenTransfer.TargetAddress.String(),
			tokenTransfer.TargetChain,
			tokenTransfer.FromAddress.String(),
			base64.StdEncoding.EncodeToString(tokenTransfer.Payload),
		)
		err = row.Scan(&tableId)
		if err != nil {
			return 0, fmt.Errorf("failed to insert token_transfer: %w", err)
		}
		return
	default:
		return 0, fmt.Errorf("unknown payload id")
	}
}

func (w *postgreSqlWriter) writeAssetMeta(tx *sql.Tx, assetMeta *AssetMetaPayload) (tableId int64, err error) {
	builder := strings.Builder{}
	builder.WriteString("insert into ")
	builder.WriteString(w.dbCfg.Schema)
	builder.WriteString(".")
	builder.WriteString(TableNamePayloadAssetMeta)
	builder.WriteString(" (payload_id, token_address, token_chain, decimals, symbol, token_name, create_time)")
	builder.WriteString(" values ($1,$2,$3,$4,$5,$6,now()) RETURNING id")
	exec := builder.String()
	row := tx.QueryRowContext(w.ctx, exec,
		assetMeta.PayloadID,
		assetMeta.TokenAddress.String(),
		assetMeta.TokenChain,
		assetMeta.Decimals,
		assetMeta.Symbol,
		assetMeta.Name)
	err = row.Scan(&tableId)
	if err != nil {
		return 0, fmt.Errorf("failed to insert asset_meta: %w", err)
	}
	return
}

func (w *postgreSqlWriter) writeMessagePublication(msg *MessagePublication, hostname string) error {
	// load payload
	payload, err := DeserializeVAAPayload(msg.VAA.Payload)
	if err != nil {
		return fmt.Errorf("failed to deserialize VAA payload: %w", err)
	}
	// begin a transaction
	tx, err := w.db.BeginTx(w.ctx, &sql.TxOptions{
		Isolation: sql.LevelRepeatableRead,
	})
	if err != nil {
		return fmt.Errorf("failed to begin tx: %w", err)
	}
	defer w.CleanTransaction(tx)

	// save payload
	var tableId int64
	switch payload.GetPayloadID() {
	case TokenTransferPayloadID:
		tableId, err = w.writeTokenTransfer(tx, payload.(*TokenTransferPayload))
		if err != nil {
			return err
		}
	case AssetMetaPayloadID:
		tableId, err = w.writeAssetMeta(tx, payload.(*AssetMetaPayload))
		if err != nil {
			return err
		}
	case TokenTransferWithPayloadPayloadID:
		tableId, err = w.writeTokenTransfer(tx, payload.(*TokenTransferPayload))
		if err != nil {
			return err
		}
	default:
		return fmt.Errorf("unknown payload id [%d]", payload.GetPayloadID())
	}

	// save message_publication
	builder := strings.Builder{}
	builder.WriteString("insert into ")
	builder.WriteString(w.dbCfg.Schema)
	builder.WriteString(".")
	builder.WriteString(TableNameMessagePublication)
	builder.WriteString(" (emitter_chain, emitter_address, msg_sequence, vaa_version, guardian_set_index,")
	builder.WriteString(" pub_timestamp, nonce, initiating_tx_id, payload, payload_table_id, reporter_host_name)")
	builder.WriteString(" values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)")
	exec := builder.String()
	_, err = tx.ExecContext(w.ctx, exec,
		msg.VAA.EmitterChain,
		msg.VAA.EmitterAddress.String(),
		w.ConvertValue(msg.VAA.Sequence),
		msg.VAA.Version,
		msg.VAA.GuardianSetIndex,
		msg.VAA.Timestamp,
		msg.VAA.Nonce,
		msg.InitiatingTxID.String(),
		base64.StdEncoding.EncodeToString(msg.VAA.Payload),
		tableId,
		hostname)
	if err != nil {
		return err
	}

	err = tx.Commit()
	if err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}

func (w *postgreSqlWriter) writeQuorumState(v *vaa.VAA) error {
	// save message_publication
	builder := strings.Builder{}
	builder.WriteString("insert into ")
	builder.WriteString(w.dbCfg.Schema)
	builder.WriteString(".")
	builder.WriteString(TableNameQuorumState)
	builder.WriteString(" (emitter_chain, emitter_address, msg_sequence, signed_vaa, create_time)")
	builder.WriteString(" values ($1, $2, $3, $4, now())")
	exec := builder.String()
	vaaMarshal, err := v.Marshal()
	if err != nil {
		return fmt.Errorf("failed to marshal signed vaa")
	}
	_, err = w.db.ExecContext(w.ctx, exec,
		v.EmitterChain,
		v.EmitterAddress.String(),
		w.ConvertValue(v.Sequence),
		base64.StdEncoding.EncodeToString(vaaMarshal))
	if err != nil {
		return fmt.Errorf("failed to insert quorum_state: %w", err)
	}
	return nil
}
