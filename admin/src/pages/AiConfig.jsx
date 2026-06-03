import { useEffect, useState } from "react";
import { api } from "../api.js";
import { PageHead } from "../components/Layout.jsx";
import { ErrorBox, Spinner, useToast } from "../components/ui.jsx";

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span className="toggle-knob" />
    </button>
  );
}

function NumberField({ label, hint, value, min, max, onChange }) {
  return (
    <div className="cfg-row">
      <div className="cfg-info">
        <div className="cfg-label">{label}</div>
        {hint ? <div className="cfg-hint">{hint}</div> : null}
      </div>
      <input
        className="input"
        style={{ maxWidth: 110 }}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      />
    </div>
  );
}

function ToggleField({ label, hint, checked, onChange }) {
  return (
    <div className="cfg-row">
      <div className="cfg-info">
        <div className="cfg-label">{label}</div>
        {hint ? <div className="cfg-hint">{hint}</div> : null}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export default function AiConfig() {
  const toast = useToast();
  const [state, setState] = useState({ loading: true, error: null });
  const [form, setForm] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [promptsText, setPromptsText] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [saving, setSaving] = useState(false);

  const [testQuery, setTestQuery] = useState("Khách sạn gần biển Mỹ Khê cho gia đình");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const applyConfig = (cfg, updated) => {
    setForm(cfg);
    setPromptsText((cfg.suggested_prompts || []).join("\n"));
    setUpdatedAt(updated);
    setApiKeyInput("");
  };

  const load = async () => {
    setState({ loading: true, error: null });
    try {
      const data = await api.getAiConfig();
      applyConfig(data.config, data.updated_at);
      setState({ loading: false, error: null });
    } catch (error) {
      setState({ loading: false, error });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        chat_generate: form.chat_generate,
        chat_candidate_limit: form.chat_candidate_limit,
        chat_semantic_limit: form.chat_semantic_limit,
        chat_output_places: form.chat_output_places,
        chat_output_matches: form.chat_output_matches,
        review_summary_use_llm: form.review_summary_use_llm,
        welcome_message: form.welcome_message || "",
        suggested_prompts: promptsText.split("\n").map((s) => s.trim()).filter(Boolean),
        chat_provider: form.chat_provider || "",
        chat_base_url: form.chat_base_url || "",
        chat_model: form.chat_model || "",
        embed_model: form.embed_model || "",
        chat_temperature: form.chat_temperature || "",
      };
      if (apiKeyInput.trim()) {
        payload.chat_api_key = apiKeyInput.trim();
      }
      const data = await api.updateAiConfig(payload);
      applyConfig(data.config, data.updated_at);
      toast.success("Đã lưu cấu hình AI");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testAiConnection(testQuery);
      setTestResult(res);
    } catch (error) {
      setTestResult({ ok: false, error: error.message });
    } finally {
      setTesting(false);
    }
  };

  if (state.loading) return <Spinner label="Đang tải cấu hình..." />;
  if (state.error) return <ErrorBox error={state.error} onRetry={load} />;

  const apiKeyPlaceholder = form.chat_api_key_set
    ? `${form.chat_api_key_hint} (nguồn: ${form.chat_api_key_source === "admin" ? "admin" : ".env"})`
    : "Chưa cấu hình";

  return (
    <>
      <PageHead
        title="Cấu hình AI"
        subtitle="Tham số AI áp dụng cho chat & tóm tắt review trong app mobile"
        actions={
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        }
      />

      {updatedAt ? (
        <p className="muted" style={{ fontSize: 12, marginTop: -10, marginBottom: 18 }}>
          Cập nhật lần cuối: {new Date(updatedAt).toLocaleString("vi-VN")}
        </p>
      ) : null}

      <div className="hint-banner" style={{ background: "var(--brand-soft)", borderColor: "#bcd0ff", color: "var(--brand)" }}>
        Thay đổi tại đây được lưu vào database và áp dụng <strong>ngay cho backend</strong> ở
        request kế tiếp (không cần khởi động lại). Khi để trống một trường kết nối, hệ thống dùng
        giá trị mặc định trong <code>.env</code>.
      </div>

      {/* Kết nối AI */}
      <div className="panel panel-pad" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <div>
            <h3 className="panel-title">Kết nối AI (LLM provider)</h3>
            <p className="panel-desc">URL, API key và model dùng cho RAG / chat</p>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field-label">Provider</label>
            <select className="select" value={form.chat_provider} onChange={(e) => set("chat_provider", e.target.value)}>
              <option value="openai_compatible">openai_compatible</option>
              <option value="anthropic">anthropic</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Chat model</label>
            <input className="input" value={form.chat_model} onChange={(e) => set("chat_model", e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label className="field-label">Base URL</label>
          <input
            className="input"
            value={form.chat_base_url}
            onChange={(e) => set("chat_base_url", e.target.value)}
            placeholder="http://127.0.0.1:39647/v1"
          />
        </div>

        <div className="field">
          <label className="field-label">
            API key {form.chat_api_key_set ? <span className="badge badge-green" style={{ marginLeft: 6 }}>đã cấu hình</span> : <span className="badge badge-amber" style={{ marginLeft: 6 }}>chưa có</span>}
          </label>
          <input
            className="input"
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder={apiKeyPlaceholder}
          />
          <div className="cfg-hint" style={{ marginTop: 6 }}>
            Để trống nếu giữ nguyên key hiện tại. Nhập giá trị mới để ghi đè.
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field-label">Embedding model</label>
            <input className="input" value={form.embed_model} onChange={(e) => set("embed_model", e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">Temperature</label>
            <input className="input" value={form.chat_temperature} onChange={(e) => set("chat_temperature", e.target.value)} placeholder="vd: 0.3" />
          </div>
        </div>
      </div>

      {/* Test connection */}
      <div className="panel panel-pad" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <div>
            <h3 className="panel-title">Test connection</h3>
            <p className="panel-desc">Gọi thẳng tới endpoint LLM (chat trực tiếp, không qua context của app)</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <textarea
            className="textarea"
            style={{ minHeight: 46, flex: 1 }}
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder="Nhập câu hỏi thử, vd: Homestay gần An Thượng có hồ bơi"
          />
          <button className="btn btn-primary" onClick={runTest} disabled={testing} style={{ whiteSpace: "nowrap" }}>
            {testing ? "Đang test..." : "▶ Test"}
          </button>
        </div>

        <p className="cfg-hint" style={{ marginTop: 8 }}>
          Lưu ý: nên bấm <strong>Lưu thay đổi</strong> trước khi test để dùng cấu hình mới nhất.
        </p>

        {testing ? (
          <div className="test-box"><Spinner label="Đang gọi AI..." /></div>
        ) : testResult ? (
          <div className={`test-box ${testResult.ok ? "ok" : "fail"}`}>
            <div className="test-head">
              <span className={`badge ${testResult.ok ? "badge-green" : "badge-red"}`}>
                {testResult.ok ? "✓ AI phản hồi bình thường" : "✗ Không nhận được phản hồi"}
              </span>
              {typeof testResult.latency_ms === "number" ? (
                <span className="cell-dim">{testResult.latency_ms} ms</span>
              ) : null}
              {testResult.model ? <span className="cell-dim">model: {testResult.model}</span> : null}
              {testResult.status ? <span className="cell-dim">HTTP {testResult.status}</span> : null}
            </div>
            {testResult.endpoint ? (
              <div className="cfg-hint" style={{ marginBottom: 10, wordBreak: "break-all" }}>
                → {testResult.endpoint}
              </div>
            ) : null}
            {testResult.answer ? (
              <div className="test-answer">{testResult.answer}</div>
            ) : null}
            {testResult.error ? (
              <div className="test-answer" style={{ color: "var(--red)" }}>{testResult.error}</div>
            ) : null}
            {testResult.details ? (
              <pre className="test-details">{testResult.details}</pre>
            ) : null}
            {testResult.semantic_error ? (
              <div className="cfg-hint" style={{ color: "var(--amber)", marginTop: 8 }}>
                semantic_error: {testResult.semantic_error}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Tham số chat & review */}
      <div className="cfg-grid">
        <div className="panel panel-pad">
          <div className="panel-head">
            <div>
              <h3 className="panel-title">Chat AI (/chat/query)</h3>
              <p className="panel-desc">Điều khiển gợi ý chỗ ở khi người dùng chat</p>
            </div>
          </div>

          <ToggleField
            label="Sinh câu trả lời bằng LLM"
            hint="Tắt để chỉ dùng câu trả lời dạng template (nhanh, rẻ hơn)"
            checked={!!form.chat_generate}
            onChange={(v) => set("chat_generate", v)}
          />
          <NumberField label="Số ứng viên truy xuất" hint="candidate_limit (1–30)" value={form.chat_candidate_limit} min={1} max={30} onChange={(v) => set("chat_candidate_limit", v)} />
          <NumberField label="Số kết quả ngữ nghĩa" hint="semantic_limit (1–20)" value={form.chat_semantic_limit} min={1} max={20} onChange={(v) => set("chat_semantic_limit", v)} />
          <NumberField label="Số địa điểm gợi ý" hint="output_places (1–10)" value={form.chat_output_places} min={1} max={10} onChange={(v) => set("chat_output_places", v)} />
          <NumberField label="Số semantic match trả về" hint="output_matches (1–10)" value={form.chat_output_matches} min={1} max={10} onChange={(v) => set("chat_output_matches", v)} />
        </div>

        <div className="panel panel-pad">
          <div className="panel-head">
            <div>
              <h3 className="panel-title">Tóm tắt review & hiển thị</h3>
              <p className="panel-desc">Cấu hình tóm tắt đánh giá và nội dung gợi ý</p>
            </div>
          </div>

          <ToggleField
            label="Dùng LLM để tóm tắt review"
            hint="Tắt để dùng tóm tắt heuristic (không gọi LLM)"
            checked={!!form.review_summary_use_llm}
            onChange={(v) => set("review_summary_use_llm", v)}
          />

          <div style={{ marginTop: 18 }}>
            <div className="field">
              <label className="field-label">Lời chào AI</label>
              <textarea
                className="textarea"
                value={form.welcome_message || ""}
                onChange={(e) => set("welcome_message", e.target.value)}
                placeholder="Xin chào! Mình có thể giúp bạn tìm chỗ ở tại Đà Nẵng..."
              />
            </div>
            <div className="field">
              <label className="field-label">Câu gợi ý nhanh (mỗi dòng một câu)</label>
              <textarea
                className="textarea"
                value={promptsText}
                onChange={(e) => setPromptsText(e.target.value)}
                placeholder={"Khách sạn gần biển\nHomestay cho gia đình\nResort có hồ bơi"}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
