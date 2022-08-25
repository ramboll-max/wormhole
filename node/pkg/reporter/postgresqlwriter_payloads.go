package reporter

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"github.com/certusone/wormhole/node/pkg/vaa"
	"github.com/ethereum/go-ethereum/common"
	"math/big"
)

// TokenBridgeModule is the identifier of the TokenBridge module (which is used for token bridge messages)
var TokenBridgeModule = []byte{00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 0x54, 0x6f, 0x6b, 0x65, 0x6e, 0x42, 0x72, 0x69, 0x64, 0x67, 0x65}

type Payload interface {
	GetPayloadID() PayloadID
}

type PayloadID uint8

const (
	TokenTransferPayloadID            PayloadID = 1
	AssetMetaPayloadID                PayloadID = 2
	TokenTransferWithPayloadPayloadID PayloadID = 3
)

type AssetMetaPayload struct {
	PayloadID    PayloadID
	TokenAddress vaa.Address
	TokenChain   vaa.ChainID
	Decimals     uint8
	Symbol       string
	Name         string
}

func (p AssetMetaPayload) GetPayloadID() PayloadID {
	return p.PayloadID
}

type TokenTransferPayload struct {
	PayloadID     PayloadID
	Amount        *big.Int
	TokenAddress  vaa.Address
	TokenChain    vaa.ChainID
	TargetAddress vaa.Address
	TargetChain   vaa.ChainID

	// Fee for relaying, only when PayloadID=1
	Fee *big.Int

	// only when PayloadID=3
	FromAddress vaa.Address
	Payload     []byte
}

func (p TokenTransferPayload) GetPayloadID() PayloadID {
	return p.PayloadID
}

func DeserializeVAAPayload(payload []byte) (Payload, error) {
	// PayloadID
	payloadID := PayloadID(payload[0])
	reader := bytes.NewReader(payload[1:])
	switch payloadID {
	case TokenTransferPayloadID, TokenTransferWithPayloadPayloadID:
		res := &TokenTransferPayload{PayloadID: payloadID}
		// Amount
		amountBytes := make([]byte, 32)
		if n, err := reader.Read(amountBytes[:]); err != nil || n != 32 {
			return nil, fmt.Errorf("failed to read amount: %w", err)
		}
		res.Amount = big.NewInt(0).SetBytes(amountBytes)
		// TokenAddress
		if n, err := reader.Read(res.TokenAddress[:]); err != nil || n != 32 {
			return nil, fmt.Errorf("failed to read token address: %w", err)
		}
		// TokenChain
		if err := binary.Read(reader, binary.BigEndian, &res.TokenChain); err != nil {
			return nil, fmt.Errorf("failed to read token chain: %w", err)
		}
		// TargetAddress
		if n, err := reader.Read(res.TargetAddress[:]); err != nil || n != 32 {
			return nil, fmt.Errorf("failed to read target address: %w", err)
		}
		// TargetChain
		if err := binary.Read(reader, binary.BigEndian, &res.TargetChain); err != nil {
			return nil, fmt.Errorf("faile to read target chain: %w", err)
		}
		if payloadID == TokenTransferPayloadID {
			// Fee
			feeBytes := make([]byte, 32)
			if n, err := reader.Read(feeBytes[:]); err != nil || n != 32 {
				return nil, fmt.Errorf("failed to read fee: %w", err)
			}
			res.Fee = big.NewInt(0).SetBytes(feeBytes)
		} else if payloadID == TokenTransferWithPayloadPayloadID {
			// FromAddress
			if n, err := reader.Read(res.FromAddress[:]); err != nil || n != 32 {
				return nil, fmt.Errorf("failed to read from address: %w", err)
			}
			// Payload
			p := make([]byte, 1000)
			n, err := reader.Read(p)
			if err != nil {
				return nil, fmt.Errorf("failed to read payload: %w", err)
			}
			res.Payload = p[:n]
		}
		return res, nil
	case AssetMetaPayloadID:
		res := &AssetMetaPayload{PayloadID: payloadID}
		// TokenAddress
		if n, err := reader.Read(res.TokenAddress[:]); err != nil || n != 32 {
			return nil, fmt.Errorf("failed to read token address: %w", err)
		}
		// TokenChain
		if err := binary.Read(reader, binary.BigEndian, &res.TokenChain); err != nil {
			return nil, fmt.Errorf("failed to read token chain: %w", err)
		}
		// Decimals
		if err := binary.Read(reader, binary.BigEndian, &res.Decimals); err != nil {
			return nil, fmt.Errorf("failed to read decimals: %w", err)
		}
		// Symbol
		symbolBytes := make([]byte, 32)
		n, err := reader.Read(symbolBytes)
		if err != nil || n != 32 {
			return nil, fmt.Errorf("failed to read symbol: %w", err)
		}
		symbolBytes = common.TrimRightZeroes(symbolBytes)
		res.Symbol = string(symbolBytes)
		// Name
		nameBytes := make([]byte, 32)
		n, err = reader.Read(nameBytes)
		if err != nil || n != 32 {
			return nil, fmt.Errorf("failed to read name: %w", err)
		}
		nameBytes = common.TrimRightZeroes(nameBytes)
		res.Name = string(nameBytes)
		return res, nil
	default:
		return nil, errors.New("unknown payload id")
	}
}
