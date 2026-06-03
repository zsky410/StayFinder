import { useEffect, useState } from "react";
import { api } from "../api.js";
import { PageHead } from "../components/Layout.jsx";
import { BarChart, ColumnChart, DonutChart, ErrorBox, Spinner } from "../components/ui.jsx";
import { IconRefresh } from "../components/icons.jsx";

function StatCard({ label, value, hint, icon, tint }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className="stat-ico" style={{ background: tint.bg, color: tint.fg }}>
          {icon}
        </span>
      </div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}

export default function Dashboard() {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = async () => {
    setState({ loading: true, error: null, data: null });
    try {
      const [meta, places] = await Promise.all([
        api.filtersMeta(),
        api.listPlaces({ limit: 1, page: 1 }),
      ]);
      setState({ loading: false, error: null, data: { meta, places } });
    } catch (error) {
      setState({ loading: false, error, data: null });
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (state.loading) return <Spinner label="Đang tải số liệu..." />;
  if (state.error) return <ErrorBox error={state.error} onRetry={load} />;

  const { meta, places } = state.data;
  const totalPlaces = places?.total ?? 0;
  const types = meta?.types || [];
  const districts = meta?.districts || [];
  const ratingRange = meta?.rating_range || {};

  const typeData = types
    .slice(0, 8)
    .map((t) => ({ label: t.label || t.value, value: t.count || 0 }));

  const districtTop = districts
    .slice(0, 6)
    .map((d) => ({ label: d.value, value: d.count || 0 }));

  const districtRanking = districts
    .slice(0, 10)
    .map((d) => ({ label: d.value, value: d.count || 0 }));

  return (
    <>
      <PageHead
        title="Dashboard"
        subtitle="Tổng quan dữ liệu StayFinder"
        actions={
          <button className="btn" onClick={load}>
            <IconRefresh width={15} height={15} />
            Làm mới
          </button>
        }
      />

      <div className="card-grid">
        <StatCard
          label="Tổng địa điểm"
          value={totalPlaces.toLocaleString("vi-VN")}
          hint="Tất cả địa điểm trong DB"
          icon="🏨"
          tint={{ bg: "var(--brand-soft)", fg: "var(--brand)" }}
        />
        <StatCard
          label="Khu vực"
          value={districts.length}
          hint="Số quận/khu vực"
          icon="🗺️"
          tint={{ bg: "var(--green-soft)", fg: "var(--green)" }}
        />
        <StatCard
          label="Loại hình"
          value={types.length}
          hint="Số phân loại địa điểm"
          icon="🏷️"
          tint={{ bg: "var(--brand-soft-2)", fg: "var(--brand-2)" }}
        />
        <StatCard
          label="Khoảng rating"
          value={ratingRange.min != null ? `${ratingRange.min}–${ratingRange.max}` : "—"}
          hint="Đánh giá min – max"
          icon="⭐"
          tint={{ bg: "var(--amber-soft)", fg: "var(--amber)" }}
        />
      </div>

      <div className="dash-grid">
        <div className="panel panel-pad">
          <div className="panel-head">
            <div>
              <h3 className="panel-title">Top khu vực</h3>
              <p className="panel-desc">Số địa điểm nhiều nhất theo khu vực</p>
            </div>
          </div>
          <ColumnChart data={districtTop} />
        </div>

        <div className="panel panel-pad">
          <div className="panel-head">
            <div>
              <h3 className="panel-title">Phân loại địa điểm</h3>
              <p className="panel-desc">Tỷ trọng theo loại hình</p>
            </div>
          </div>
          <DonutChart data={typeData} centerLabel="địa điểm" />
        </div>
      </div>

      <div className="panel panel-pad" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <div>
            <h3 className="panel-title">Xếp hạng khu vực chi tiết</h3>
            <p className="panel-desc">Top 10 khu vực theo số địa điểm</p>
          </div>
        </div>
        <BarChart data={districtRanking} colored />
      </div>
    </>
  );
}
