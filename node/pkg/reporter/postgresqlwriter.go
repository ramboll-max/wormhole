package reporter

import (
	"context"
	"database/sql"
	"fmt"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	_ "github.com/lib/pq"
	"go.uber.org/zap"
	"os"
)

const (
	DefaultDataBase = "postgres"
	DefaultSchema   = "public"
	DefaultPort     = 5432
	DefaultHost     = "localhost"
	DefaultSSLMode  = "disable"
)

type PostgreSqlConnectionConfig struct {
	Host     string
	Port     int
	Database string
	Schema   string
	User     string
	Password string
	SSLMode  string
}

func (c *PostgreSqlConnectionConfig) FillDefault() *PostgreSqlConnectionConfig {
	c.Host = DefaultHost
	c.Port = DefaultPort
	c.Database = DefaultDataBase
	c.Schema = DefaultSchema
	c.SSLMode = DefaultSSLMode
	return c
}

type postgreSqlWriter struct {
	ctx    context.Context
	logger *zap.Logger
	dbCfg  *PostgreSqlConnectionConfig
	db     *sql.DB
	events *AttestationEventReporter
}

func (w *postgreSqlWriter) connectDB() error {
	pgsqlInfo := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		w.dbCfg.Host, w.dbCfg.Port, w.dbCfg.User, w.dbCfg.Password, w.dbCfg.Database)
	db, err := sql.Open("postgres", pgsqlInfo)
	if err != nil {
		return err
	}

	err = db.Ping()
	if err != nil {
		return err
	}

	db.SetMaxIdleConns(10)
	db.SetMaxOpenConns(200)

	w.db = db
	return nil
}

func (w *postgreSqlWriter) close() error {
	if w == nil {
		return nil
	}
	if w.db == nil {
		return nil
	}
	return w.db.Close()
}

func PostgreSqlWriter(events *AttestationEventReporter, cfg *PostgreSqlConnectionConfig) func(ctx context.Context) error {
	return func(ctx context.Context) error {
		logger := supervisor.Logger(ctx)
		w := &postgreSqlWriter{
			ctx:    ctx,
			logger: logger,
			dbCfg:  cfg,
			events: events,
		}

		if err := w.connectDB(); err != nil {
			return err
		}
		defer w.close()

		if err := w.initSchema(); err != nil {
			return err
		}
		if err := w.initTables(); err != nil {
			return err
		}

		hostname, err := os.Hostname()
		if err != nil {
			panic(err)
		}

		errC := make(chan error)
		// call to subscribe to event channels
		sub := w.events.Subscribe()
		logger.Info("subscribed to AttestationEvents")

		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case msg := <-sub.Channels.MessagePublicationC:
					err = w.writeMessagePublication(msg, hostname)
					if err != nil {
						logger.Error("Failed to write message publication to PostgreSQL",
							zap.String("EmitterChain", msg.VAA.EmitterChain.String()),
							zap.String("EmitterAddress", msg.VAA.EmitterAddress.String()),
							zap.Uint64("MsgSequence", msg.VAA.Sequence),
							zap.Error(err))
						errC <- err
					}
				case msg := <-sub.Channels.VAAQuorumC:
					err = w.writeQuorumState(msg)
					if err != nil {
						logger.Error("Failed to write persistence info to PostgreSQL",
							zap.String("EmitterChain", msg.EmitterChain.String()),
							zap.String("EmitterAddress", msg.EmitterAddress.String()),
							zap.Uint64("MsgSequence", msg.Sequence),
							zap.Error(err))
						errC <- err
					}
				}
			}
		}()

		select {
		case <-ctx.Done():
			w.events.Unsubscribe(sub.ClientId)
			return ctx.Err()
		case err := <-errC:
			logger.Error("PostgreSql writer encountered an error", zap.Error(err))
			w.events.Unsubscribe(sub.ClientId)
			return err
		}
	}
}
