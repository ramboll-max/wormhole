package reporter

import (
	"database/sql"
	"fmt"
)

const (
	TableNameMessagePublication   = "message_publication"
	TableNameQuorumState          = "quorum_state"
	TableNamePayloadAssetMeta     = "payload_asset_meta"
	TableNamePayloadNFTTransfer   = "payload_nft_transfer"
	TableNamePayloadTokenTransfer = "payload_token_transfer"

	MessagePublicationDDLTemplate = `CREATE TABLE %s.message_publication (
	emitter_chain int4 NOT NULL,
	emitter_address varchar(128) NOT NULL,
	msg_sequence numeric(32) NOT NULL,
	vaa_version int2 NOT NULL,
	guardian_set_index int4 NOT NULL,
	pub_timestamp timestamptz NOT NULL,
	nonce int8 NOT NULL,
	initiating_tx_id varchar(128) NOT NULL,
	payload text NOT NULL,
	payload_table_id int8 NOT NULL,
	reporter_host_name varchar(256) NULL,
	CONSTRAINT message_publication_pkey PRIMARY KEY (emitter_chain, emitter_address, msg_sequence)
)`
	QuorumStateDDLTemplate = `CREATE TABLE %s.quorum_state (
	emitter_chain int4 NOT NULL,
	emitter_address varchar(128) NOT NULL,
	msg_sequence numeric(32) NOT NULL,
	signed_vaa text NOT NULL,
	create_time timestamptz NOT NULL,
	CONSTRAINT quorum_state_pkey PRIMARY KEY (emitter_chain, emitter_address, msg_sequence)
)`
	PayloadAssetMetaTemplate = `CREATE TABLE %s.payload_asset_meta (
	id bigserial NOT NULL,
	payload_id int2 NOT NULL,
	token_address varchar(128) NOT NULL,
	token_chain int4 NOT NULL,
	decimals int2 NOT NULL,
	symbol varchar(16) NOT NULL,
	token_name varchar(128) NOT NULL,
	create_time timestamptz NOT NULL,
	CONSTRAINT payload_asset_meta_pkey PRIMARY KEY (id)
)`
	PayloadNFTTransferTemplate = `CREATE TABLE %s.payload_nft_transfer (
	id bigserial NOT NULL,
	payload_id int2 NOT NULL,
	origin_address varchar(128) NOT NULL,
	origin_chain int4 NOT NULL,
	nft_symbol varchar(64) NOT NULL,
	nft_name varchar(128) NOT NULL,
	nft_token_id numeric(256) NOT NULL,
	nft_uri varchar(512) NOT NULL,
	target_address varchar(128) NOT NULL,
	target_chain int4 NOT NULL,
	create_time timestamptz NOT NULL,
	CONSTRAINT payload_nft_transfer_pkey PRIMARY KEY (id)
)`
	PayloadTokenTransferTemplate = `CREATE TABLE %s.payload_token_transfer (
	id bigserial NOT NULL,
	payload_id int2 NOT NULL,
	amount numeric(128) NOT NULL,
	origin_address varchar(128) NOT NULL,
	origin_chain int4 NOT NULL,
	target_address varchar(128) NOT NULL,
	target_chain int4 NOT NULL,
	fee numeric(128) NULL,
	from_address varchar(128) NULL,
	payload text NULL,
	create_time timestamptz NOT NULL,
	CONSTRAINT payload_token_transfer_pkey PRIMARY KEY (id)
)`
)

func (w *postgreSqlWriter) initTable(tableName, ddlTemplate string) error {
	sel := "select table_name from information_schema.tables where table_schema=$1 and table_type='BASE TABLE' " +
		"and table_name=$2"
	row := w.db.QueryRowContext(w.ctx, sel, w.dbCfg.Schema, tableName)
	var tmp string
	err := row.Scan(&tmp)
	if err == nil {
		w.logger.Info(fmt.Sprintf("Table %s exist, skip.", tableName))
	} else if err == sql.ErrNoRows {
		// No rows, table not exist, create it.
		w.logger.Info(fmt.Sprintf("Table %s not exist, create it.", tableName))
		exec := fmt.Sprintf(ddlTemplate, w.dbCfg.Schema)
		_, err = w.db.ExecContext(w.ctx, exec)
		if err == nil {
			w.logger.Info(fmt.Sprintf("Table %s created.", tableName))
		} else {
			w.logger.Error(fmt.Sprintf("Table %s create failed.", tableName))
		}
	}
	return err
}

func (w *postgreSqlWriter) initTables() error {
	w.logger.Info("Initialling postgre SQL database tables...")
	// table message_publication
	if err := w.initTable(TableNameMessagePublication, MessagePublicationDDLTemplate); err != nil {
		return err
	}
	// table quorum_state
	if err := w.initTable(TableNameQuorumState, QuorumStateDDLTemplate); err != nil {
		return err
	}
	// table payload_asset_meta
	if err := w.initTable(TableNamePayloadAssetMeta, PayloadAssetMetaTemplate); err != nil {
		return err
	}
	// table payload_nft_transfer
	if err := w.initTable(TableNamePayloadNFTTransfer, PayloadNFTTransferTemplate); err != nil {
		return err
	}
	// table payload_token_transfer
	if err := w.initTable(TableNamePayloadTokenTransfer, PayloadTokenTransferTemplate); err != nil {
		return err
	}

	return nil
}
