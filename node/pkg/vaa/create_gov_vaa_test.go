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
	"math/big"
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
	tokenBridgeAddr := "0x72c82f10239F22b621e1D5be8dC36C6e55AFDCD1"
	bz, err := hex.DecodeString(tokenBridgeAddr[2:])
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
		EmitterChain:     ChainIDMetaOS,
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
		EmitterChain:     ChainIDMetaOS,
		EmitterAddress:   GovernanceEmitter,
		Payload:          registerChain.Serialize(),
	}
	vaa.AddSignature(key, 0)
	vaaData, _ := vaa.Marshal()
	println(hex.EncodeToString(vaaData))
}

func TestCreateRegisterChainVAA_MetaOS(t *testing.T) {
	metaOSTokenBridgeAddr := "mtos1nc5tatafv6eyq7llkr2gv50ff9e22mnf70qgjlv737ktmt4eswrquz2k54"
	bz, err := sdk.GetFromBech32(metaOSTokenBridgeAddr, "mtos")
	require.NoError(t, err)
	bz = common.LeftPadBytes(bz, 32)
	emitter := Address{}
	copy(emitter[:], bz)
	registerChain := BodyTokenBridgeRegisterChain{
		Module:         "TokenBridge",
		ChainID:        ChainIDMetaOS,
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
		EmitterChain:     ChainIDMetaOS,
		EmitterAddress:   GovernanceEmitter,
		Payload:          registerChain.Serialize(),
	}
	vaa.AddSignature(key, 0)
	vaaData, _ := vaa.Marshal()
	println(hex.EncodeToString(vaaData))
}

func TestParseMetaOSAddrToWormhole(t *testing.T) {
	metaOSAddr := "mtos1pvrwmjuusn9wh34j7y520g8gumuy9xtl3gvprlljfdpwju3x7ucs48er7a"
	bz, err := sdk.GetFromBech32(metaOSAddr, "mtos")
	require.NoError(t, err)
	bz = common.LeftPadBytes(bz, 32)
	println(hex.EncodeToString(bz))
}

func TestTmp(t *testing.T) {
	//mtosAddr := "umtos"
	//h := crypto.Keccak256Hash([]byte(mtosAddr))
	//h[0] = 1
	//println(hex.EncodeToString(h[:]))
	z := big.NewInt(2)
	z = z.Lsh(z, 128)
	println(z.String())
	//println(1 << 3)
}
