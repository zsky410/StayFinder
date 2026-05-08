import { PlaceholderScreen } from "@/components/placeholder-screen";
import { theme } from "@/constants/theme";

export default function ProfileTabRoute() {
  return (
    <PlaceholderScreen
      badge="Cá nhân"
      title="Profile"
      description="Tab Cá nhân đã được thêm vào để khớp với mockup Home mới. Hiện tại đây vẫn là màn placeholder, đủ để demo navigation bottom tab."
      accent={theme.colors.accent}
      footerNote="Sau này có thể đặt thông tin người dùng, cài đặt, quyền riêng tư hoặc saved preferences tại đây."
    />
  );
}
