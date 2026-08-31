package utils

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

func TimestamptzToTimePtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}

	result := value.Time
	return &result
}
