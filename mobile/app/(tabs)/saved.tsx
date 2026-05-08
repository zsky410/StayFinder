import { PlaceholderScreen } from "@/components/placeholder-screen";
import { theme } from "@/constants/theme";

export default function SavedTabRoute() {
  return (
    <PlaceholderScreen
      badge="Đã lưu"
      title="Saved / Recent"
      description="Tab này đại diện cho phần danh sách đã lưu và lịch sử gần đây trên thiết bị. Phase 4 v1 chỉ cần local storage, chưa cần đồng bộ cloud."
      accent={theme.colors.plum}
      footerNote="Khi vào bước nối dữ liệu thật, tab này có thể lưu local bằng AsyncStorage hoặc SQLite tùy bạn chọn."
    />
  );
}
