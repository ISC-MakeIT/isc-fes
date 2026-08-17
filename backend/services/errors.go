package services

import "errors"

var (
	ErrConflict           = errors.New("conflict")
	ErrFailedToStoreImage = errors.New("failed to store image")
)
