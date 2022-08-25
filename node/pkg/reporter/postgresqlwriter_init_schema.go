package reporter

import (
	"database/sql"
	"fmt"
)

func (w *postgreSqlWriter) initSchema() error {
	w.logger.Info("Initialling postgre SQL database schema...")
	// query schema
	sel := "select schema_name from information_schema.schemata where schema_name=$1"
	row := w.db.QueryRowContext(w.ctx, sel, w.dbCfg.Schema)
	var schemaName string
	err := row.Scan(&schemaName)
	if err == nil {
		w.logger.Info(fmt.Sprintf("Schema %s exist, skip.", w.dbCfg.Schema))
	} else if err == sql.ErrNoRows {
		// No rows, schema not exist, create it.
		w.logger.Info(fmt.Sprintf("Schema %s not exist, create it.", w.dbCfg.Schema))
		exec := "create schema " + w.dbCfg.Schema
		_, err = w.db.ExecContext(w.ctx, exec)
		if err != nil {
			w.logger.Info(fmt.Sprintf("Schema %s created.", w.dbCfg.Schema))
		}
	}
	return err
}
