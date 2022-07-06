package guardiand

import (
	"context"
	"encoding/hex"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	publicrpcv1 "github.com/certusone/wormhole/node/pkg/proto/publicrpc/v1"
	"github.com/certusone/wormhole/node/pkg/vaa"
	"github.com/davecgh/go-spew/spew"

	"github.com/spf13/cobra"
	"google.golang.org/grpc"
)

var (
	nodeRPC *string
)

func init() {
	nodeRPC = GetSignedVAAByMessageID.Flags().String("rpc", "", "Server rpc to connect to")
	_ = GetSignedVAAByMessageID.MarkFlagRequired("rpc")
	RpcClientCmd.AddCommand(GetSignedVAAByMessageID)
}

var RpcClientCmd = &cobra.Command{
	Use:   "rpc-client",
	Short: "Guardian node web client commands",
}

var GetSignedVAAByMessageID = &cobra.Command{
	Use:   "get-signed-vaa-by-message-id [MESSAGE_ID]",
	Short: "Retrieve a VAA by message ID (chain/emitter/seq) and decode and dump the VAA",
	Run:   runGetSignedVAAByMessageID,
	Args:  cobra.ExactArgs(1),
}

func getPublicRPCServiceClientForWeb(ctx context.Context, addr string) (*grpc.ClientConn, error, publicrpcv1.PublicRPCServiceClient) {
	conn, err := grpc.DialContext(ctx, addr, grpc.WithInsecure())

	if err != nil {
		log.Fatalf("failed to connect to %s: %v", addr, err)
	}

	c := publicrpcv1.NewPublicRPCServiceClient(conn)
	return conn, err, c
}

// runGetSignedVAAByMessageID uses GetSignedVAA to request the given message,
// then decode and dump the VAA.
func runGetSignedVAAByMessageID(cmd *cobra.Command, args []string) {
	// Parse the {chain,emitter,seq} string.
	parts := strings.Split(args[0], "/")
	if len(parts) != 3 {
		log.Fatalf("invalid message ID: %s", args[0])
	}
	chainID, err := strconv.ParseUint(parts[0], 10, 32)
	if err != nil {
		log.Fatalf("invalid chain ID: %v", err)
	}
	emitterAddress := parts[1]
	seq, err := strconv.ParseUint(parts[2], 10, 64)
	if err != nil {
		log.Fatalf("invalid sequence number: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err, c := getPublicRPCServiceClientForWeb(ctx, *nodeRPC)
	defer conn.Close()
	if err != nil {
		log.Fatalf("failed to get public RPC service client: %v", err)
	}

	msg := publicrpcv1.GetSignedVAARequest{
		MessageId: &publicrpcv1.MessageID{
			EmitterChain:   publicrpcv1.ChainID(chainID),
			EmitterAddress: emitterAddress,
			Sequence:       seq,
		},
	}
	resp, err := c.GetSignedVAA(ctx, &msg)
	if err != nil {
		log.Fatalf("failed to run GetSignedVAA RPC: %v", err)
	}

	v, err := vaa.Unmarshal(resp.VaaBytes)
	if err != nil {
		log.Fatalf("failed to decode VAA: %v", err)
	}

	log.Printf("VAA with digest %s: %+v\n", v.HexDigest(), spew.Sdump(v))
	fmt.Printf("Bytes:\n%s\n", hex.EncodeToString(resp.VaaBytes))
}
