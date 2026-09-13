package carts

import "github.com/google/uuid"

type UpdateCartInput struct {
	ExpectedVersion int32
	StoreID         uuid.UUID
	Items           []UpdateCartItemInput
}

type UpdateCartItemInput struct {
	ID         *uuid.UUID
	MenuID     uuid.UUID
	Quantity   int32
	ToppingIds []uuid.UUID
}
