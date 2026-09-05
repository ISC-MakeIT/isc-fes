type UpdateMenuSoldOutStatus = {
  soldOutStatus: boolean;
};

// TODO: APIができるまでのモック
export async function updateMenuSoldOutStatus({
  soldOutStatus,
}: UpdateMenuSoldOutStatus) {
  return soldOutStatus;
}
