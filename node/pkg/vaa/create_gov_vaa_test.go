package vaa

import (
	"crypto/ecdsa"
	"encoding/hex"
	"fmt"
	nodev1 "github.com/certusone/wormhole/node/pkg/proto/node/v1"
	sdk "github.com/cosmos/cosmos-sdk/types"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/openpgp/armor"
	"google.golang.org/protobuf/proto"
	"io/ioutil"
	"math/rand"
	"strings"
	"testing"
	"time"
)

const (
	sk = `-----BEGIN WORMHOLE GUARDIAN PRIVATE KEY-----
PublicKey: 0xAb36318fA9c449578C02583A8920fC4AC6d82D80
Description: guardian0

CiDEwishuJ47/y3p/PWAnNt5zixc38wqcS/fW0Zh7Fq1yw==
=wORs
-----END WORMHOLE GUARDIAN PRIVATE KEY-----`
)

func loadGuardianKey(sk string) (*ecdsa.PrivateKey, error) {
	p, err := armor.Decode(strings.NewReader(sk))
	if err != nil {
		return nil, fmt.Errorf("failed to read armored file: %w", err)
	}

	if p.Type != "WORMHOLE GUARDIAN PRIVATE KEY" {
		return nil, fmt.Errorf("invalid block type: %s", p.Type)
	}

	b, err := ioutil.ReadAll(p.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var m nodev1.GuardianKey
	err = proto.Unmarshal(b, &m)
	if err != nil {
		return nil, fmt.Errorf("failed to deserialize protobuf: %w", err)
	}

	gk, err := crypto.ToECDSA(m.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to deserialize raw key data: %w", err)
	}

	return gk, nil
}

func TestCreateRegisterChainVAA_ETH(t *testing.T) {
	wormholeAddr := "0x3B86Ae4b1e9c906ef18e3dc3c6cBFFE599A6A5E0"
	bz, err := hex.DecodeString(wormholeAddr[2:])
	require.NoError(t, err)
	bz = common.LeftPadBytes(bz, 32)
	emitter := Address{}
	copy(emitter[:], bz)
	registerChain := BodyTokenBridgeRegisterChain{
		Module:         "TokenBridge",
		ChainID:        2,
		EmitterAddress: emitter,
	}

	key, _ := loadGuardianKey(sk)
	vaa := &VAA{
		Version:          SupportedVAAVersion,
		GuardianSetIndex: 0,
		Signatures:       nil,
		Timestamp:        time.Unix(0, 0),
		Nonce:            rand.Uint32(),
		Sequence:         rand.Uint64(),
		ConsistencyLevel: 1,
		EmitterChain:     ChainIDSophon,
		EmitterAddress:   GovernanceEmitter,
		Payload:          registerChain.Serialize(),
	}
	vaa.AddSignature(key, 0)
	vaaData, _ := vaa.Marshal()
	println(hex.EncodeToString(vaaData))
}

func TestCreateRegisterChainVAA_Terra(t *testing.T) {
	terraAddr := "terra10pyejy66429refv3g35g2t7am0was7ya7kz2a4"
	bz, err := sdk.GetFromBech32(terraAddr, "terra")
	require.NoError(t, err)
	bz = common.LeftPadBytes(bz, 32)
	emitter := Address{}
	copy(emitter[:], bz)
	registerChain := BodyTokenBridgeRegisterChain{
		Module:         "TokenBridge",
		ChainID:        3,
		EmitterAddress: emitter,
	}
	key, _ := loadGuardianKey(sk)
	vaa := &VAA{
		Version:          SupportedVAAVersion,
		GuardianSetIndex: 0,
		Signatures:       nil,
		Timestamp:        time.Unix(0, 0),
		Nonce:            rand.Uint32(),
		Sequence:         rand.Uint64(),
		ConsistencyLevel: 15,
		EmitterChain:     ChainIDSophon,
		EmitterAddress:   GovernanceEmitter,
		Payload:          registerChain.Serialize(),
	}
	vaa.AddSignature(key, 0)
	vaaData, _ := vaa.Marshal()
	println(hex.EncodeToString(vaaData))
}

func TestCreateRegisterChainVAA_Sophon(t *testing.T) {
	sophonAddr := "sop1hzz0s0ucrhdp6tue2lxk3c03nj6f60qy463we7lgx0wudd72ctms2gr5ym"
	bz, err := sdk.GetFromBech32(sophonAddr, "sop")
	require.NoError(t, err)
	bz = common.LeftPadBytes(bz, 32)
	emitter := Address{}
	copy(emitter[:], bz)
	registerChain := BodyTokenBridgeRegisterChain{
		Module:         "TokenBridge",
		ChainID:        ChainIDSophon,
		EmitterAddress: emitter,
	}

	key, _ := loadGuardianKey(sk)
	vaa := &VAA{
		Version:          SupportedVAAVersion,
		GuardianSetIndex: 0,
		Signatures:       nil,
		Timestamp:        time.Unix(0, 0),
		Nonce:            rand.Uint32(),
		Sequence:         rand.Uint64(),
		ConsistencyLevel: 15,
		EmitterChain:     ChainIDSophon,
		EmitterAddress:   GovernanceEmitter,
		Payload:          registerChain.Serialize(),
	}
	vaa.AddSignature(key, 0)
	vaaData, _ := vaa.Marshal()
	println(hex.EncodeToString(vaaData))
}

func TestParseSophonAddrToWormhole(t *testing.T) {
	sophonAddr := "sop1wk4manyfhfx3sgzgp8k0fjf3jmra796kllxdgs"
	bz, err := sdk.GetFromBech32(sophonAddr, "sop")
	require.NoError(t, err)
	bz = common.LeftPadBytes(bz, 32)
	println(hex.EncodeToString(bz))
}
