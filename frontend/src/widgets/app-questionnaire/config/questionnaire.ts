export enum QuestionnaireTrigger {
  CartItemAdded = "cart_item_added",
  OrderCompleted = "order_completed",
  PickupCompleted = "pickup_completed",
  StoreHomeOpened = "store_home_opened",
  MenuCreated = "menu_created",
  MenuUpdated = "menu_updated",
  MenuDeleted = "menu_deleted",
  MenuAvailabilityUpdated = "menu_availability_updated",
  ToppingCreated = "topping_created",
  ToppingUpdated = "topping_updated",
  ToppingDeleted = "topping_deleted",
  ToppingAvailabilityUpdated = "topping_availability_updated",
}

export const QUESTIONNAIRE_PROBABILITIES = {
  [QuestionnaireTrigger.CartItemAdded]: 0.2,
  [QuestionnaireTrigger.OrderCompleted]: 0.2,
  [QuestionnaireTrigger.PickupCompleted]: 0.2,
  [QuestionnaireTrigger.StoreHomeOpened]: 0.2,
  [QuestionnaireTrigger.MenuCreated]: 0.2,
  [QuestionnaireTrigger.MenuUpdated]: 0.2,
  [QuestionnaireTrigger.MenuDeleted]: 0.2,
  [QuestionnaireTrigger.MenuAvailabilityUpdated]: 0.2,
  [QuestionnaireTrigger.ToppingCreated]: 0.2,
  [QuestionnaireTrigger.ToppingUpdated]: 0.2,
  [QuestionnaireTrigger.ToppingDeleted]: 0.2,
  [QuestionnaireTrigger.ToppingAvailabilityUpdated]: 0.2,
} satisfies Record<QuestionnaireTrigger, number>;

export const QUESTIONNAIRE_COOLDOWN = {
  hours: 24,
} as const;

export const LAST_REVIEW_SUBMITTED_AT_STORAGE_KEY =
  "isc-fes:last-review-submitted-at";

export const PENDING_QUESTIONNAIRE_STORAGE_KEY =
  "isc-fes:pending-questionnaire";
