package routers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"

	"github.com/getsentry/sentry-go"
	domain "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/realtime"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
)

type OrderStatusNotifier struct {
	hub *realtime.Hub
}

var _ orderservice.OrderStatusNotifier = (*OrderStatusNotifier)(nil)

func NewOrderStatusNotifier(hub *realtime.Hub) *OrderStatusNotifier {
	return &OrderStatusNotifier{hub: hub}
}

// NotifyStatusChangedはRESTと同じ公開Orderを、注文の所有Guestの全接続へ投入する。
// ネットワーク送信は待たない。更新は既にコミット済みなので通知失敗を呼び出し元へ返さない。
func (n *OrderStatusNotifier) NotifyStatusChanged(order domain.Order) {
	payload, err := json.Marshal(struct {
		Type string `json:"type"`
		Data Order  `json:"data"`
	}{Type: "order.status_changed", Data: toOrderResponse(order)})
	if err != nil {
		n.hub.ResyncGuest(order.GuestID)
		n.report(fmt.Errorf("encode order status notification for order %s: %w", order.ID, err))
		return
	}
	if err := n.hub.Publish(order.GuestID, payload); err != nil && !errors.Is(err, realtime.ErrHubStopped) {
		n.report(fmt.Errorf("publish order status notification for order %s: %w", order.ID, err))
	}
}

func (n *OrderStatusNotifier) report(err error) {
	log.Print(err)
	sentry.CaptureException(err)
}
