package services

import "errors"

var (
	ErrConflict           = errors.New("conflict")
	ErrInvalidInput       = errors.New("Invalid input")
	ErrFailedToStoreImage = errors.New("failed to store image")
)
