import { PlaceholderScreen } from "@/components/placeholder-screen";
import { theme } from "@/constants/theme";

export default function MapTabRoute() {
  return (
    <PlaceholderScreen
      badge="Bản đồ"
      title="Map View"
      description="Tab Map đang là placeholder để khóa flow điều hướng. Sau này sẽ hiển thị marker list sync với results list và hỗ trợ focus theo landmark hoặc result set."
      accent={theme.colors.coral}
      footerNote="Chưa nhúng map SDK ở vòng này để bạn ưu tiên chốt navigation và cấu trúc màn hình trước."
    />
  );
}
