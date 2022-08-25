package reporter

import (
	"context"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"testing"
)

func TestPgSql(t *testing.T) {
	cfg := &PostgreSqlConnectionConfig{
		Host:     "192.168.3.201",
		Port:     5432,
		Database: "wormhole",
		Schema:   "public",
		User:     "root",
		Password: "root",
	}

	w := &postgreSqlWriter{dbCfg: cfg, logger: zap.L(), ctx: context.Background()}
	err := w.connectDB()
	require.NoError(t, err)
	defer w.close()

	err = w.initSchema()
	require.NoError(t, err)
	err = w.initTables()
	require.NoError(t, err)

}
