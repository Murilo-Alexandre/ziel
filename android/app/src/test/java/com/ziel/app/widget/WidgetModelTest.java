package com.ziel.app.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.util.TimeZone;

public class WidgetModelTest {

    private static JSONObject item(String id, String k, String status, int w) throws Exception {
        return new JSONObject().put("id", id).put("n", id).put("c", "#5B9BE0").put("ic", "x").put("d", 0).put("k", k).put("s", status).put("p", 0.0).put("w", w).put("pw", 0.5).put("r", new JSONArray().put(11).put(12));
    }

    private static JSONObject snapshot() throws Exception {
        JSONArray today = new JSONArray()
                .put(item("grupo", "g", "pending", 0))
                .put(item("a", "o", "pending", 1))
                .put(item("b", "o", "pending", 1))
                .put(item("c", "o", "pending", 1))
                .put(item("d", "o", "pending", 1));
        JSONArray tomorrow = new JSONArray().put(item("a", "o", "pending", 1));
        JSONObject days = new JSONObject()
                .put("2026-11-26", new JSONObject().put("progress", 0).put("total", 4).put("completed", 0).put("items", today))
                .put("2026-11-27", new JSONObject().put("progress", 0).put("total", 1).put("completed", 0).put("items", tomorrow));
        JSONArray goals = new JSONArray().put(new JSONObject().put("id", "a").put("n", "Tratamento capilar").put("c", "#5B9BE0").put("ic", "x"));
        return new JSONObject().put("v", 1).put("today", "2026-11-26").put("days", days).put("goals", goals);
    }

    @Test
    public void toqueConcluiEDesfaz() {
        assertEquals("completed", WidgetModel.nextOnTap("pending"));
        assertEquals("pending", WidgetModel.nextOnTap("completed"));
        assertEquals("completed", WidgetModel.nextOnTap("partial"));
        assertEquals("completed", WidgetModel.nextOnTap("not_done"));
    }

    @Test
    public void rotulosEStatusValidos() {
        assertEquals("Pendente", WidgetModel.label("pending"));
        assertEquals("Parcial", WidgetModel.label("partial"));
        assertEquals("Concluído", WidgetModel.label("completed"));
        assertEquals("Não realizado", WidgetModel.label("not_done"));
        assertTrue(WidgetModel.isValidStatus("partial"));
        assertFalse(WidgetModel.isValidStatus("voando"));
    }

    @Test
    public void diaVemDoRelogioDoAparelhoNoFusoLocal() {
        TimeZone sp = TimeZone.getTimeZone("America/Sao_Paulo");
        // 2026-11-27 02:30 UTC = 26/11 23:30 em São Paulo (UTC-3): ainda é dia 26
        long t = java.time.OffsetDateTime.parse("2026-11-27T02:30:00Z").toInstant().toEpochMilli();
        assertEquals("2026-11-26", WidgetModel.todayKey(t, sp));
        // um minuto depois da meia-noite local
        long t2 = java.time.OffsetDateTime.parse("2026-11-27T03:01:00Z").toInstant().toEpochMilli();
        assertEquals("2026-11-27", WidgetModel.todayKey(t2, sp));
    }

    @Test
    public void marcarAtualizaStatusEProgressoDoDia() throws Exception {
        JSONObject snap = snapshot();
        assertTrue(WidgetModel.setStatus(snap, "2026-11-26", "a", "completed"));
        assertTrue(WidgetModel.setStatus(snap, "2026-11-26", "b", "partial"));
        JSONObject day = WidgetModel.day(snap, "2026-11-26");
        assertEquals(1, day.getInt("completed"));
        assertEquals(4, day.getInt("total"));
        assertEquals((1 + 0.5) / 4, day.getDouble("progress"), 1e-9);
        // corrigir: desfaz a conclusão
        assertTrue(WidgetModel.setStatus(snap, "2026-11-26", "a", "pending"));
        assertEquals(0, day.getInt("completed"));
        assertEquals(0.5 / 4, day.getDouble("progress"), 1e-9);
    }

    @Test
    public void marcacaoNaoContaminaOutroDia() throws Exception {
        JSONObject snap = snapshot();
        WidgetModel.setStatus(snap, "2026-11-26", "a", "completed");
        JSONObject amanha = WidgetModel.findItem(WidgetModel.day(snap, "2026-11-27"), "a");
        assertEquals("pending", amanha.getString("s"));
    }

    @Test
    public void grupoEItemInexistenteNaoSaoMarcaveis() throws Exception {
        JSONObject snap = snapshot();
        assertFalse(WidgetModel.setStatus(snap, "2026-11-26", "grupo", "completed"));
        assertFalse(WidgetModel.setStatus(snap, "2026-11-26", "nao-existe", "completed"));
        assertFalse(WidgetModel.setStatus(snap, "2026-12-31", "a", "completed")); // dia fora do retrato
        assertFalse(WidgetModel.setStatus(snap, "2026-11-26", "a", "voando"));
    }

    @Test
    public void itensFora_doProgressoNaoContam() throws Exception {
        JSONObject snap = snapshot();
        WidgetModel.day(snap, "2026-11-26").getJSONArray("items").getJSONObject(4).put("w", 0); // "d" é opcional
        WidgetModel.setStatus(snap, "2026-11-26", "a", "completed");
        JSONObject day = WidgetModel.day(snap, "2026-11-26");
        assertEquals(3, day.getInt("total"));
        assertEquals(1.0 / 3, day.getDouble("progress"), 1e-9);
    }

    @Test
    public void pendentesSaoReaplicadosSobreRetratoNovoNaOrdem() throws Exception {
        JSONObject snap = snapshot();
        JSONArray pending = new JSONArray()
                .put(new JSONObject().put("goalId", "a").put("date", "2026-11-26").put("status", "completed").put("ts", 1))
                .put(new JSONObject().put("goalId", "a").put("date", "2026-11-26").put("status", "pending").put("ts", 2))
                .put(new JSONObject().put("goalId", "b").put("date", "2026-11-26").put("status", "not_done").put("ts", 3));
        WidgetModel.applyPending(snap, pending);
        JSONObject day = WidgetModel.day(snap, "2026-11-26");
        assertEquals("pending", WidgetModel.findItem(day, "a").getString("s"));
        assertEquals("not_done", WidgetModel.findItem(day, "b").getString("s"));
        assertEquals(0, day.getInt("completed"));
    }

    @Test
    public void metaIndisponivelEMetaExistenteNoRetrato() throws Exception {
        JSONObject snap = snapshot();
        assertNotNull(WidgetModel.goalInfo(snap, "a"));
        assertNull(WidgetModel.goalInfo(snap, "excluida")); // widget mostra "Meta indisponível"
        assertNull(WidgetModel.day(snap, "2026-12-31")); // sem o dia: "Abra o Ziel para atualizar"
        assertNull(WidgetModel.day(null, "2026-11-26"));
        assertEquals(5, WidgetModel.itemCount(WidgetModel.day(snap, "2026-11-26")));
    }

    private static JSONObject tree() throws Exception {
        // Semana top (g) > Água (g) > 3 garrafas ; Semana top > Cross (o) ; Semana top > Alimentação (g) > Café (o)
        JSONArray items = new JSONArray()
                .put(it("semana", null, "g", "pending", 0))
                .put(it("agua", "semana", "g", "pending", 1))
                .put(it("g1", "agua", "o", "pending", 2))
                .put(it("g2", "agua", "o", "pending", 2))
                .put(it("g3", "agua", "o", "pending", 2))
                .put(it("cross", "semana", "o", "pending", 1))
                .put(it("alim", "semana", "g", "pending", 1))
                .put(it("cafe", "alim", "o", "pending", 2))
                .put(it("agual", "semana", "o", "pending", 1).put("q", new JSONObject().put("t", 3.0).put("u", "L").put("v", JSONObject.NULL)));
        JSONObject day = new JSONObject().put("progress", 0).put("total", 5).put("completed", 0).put("items", items);
        return new JSONObject().put("days", new JSONObject().put("2026-11-26", day)).put("goals", new JSONArray());
    }

    private static JSONObject it(String id, String pid, String k, String s, int d) throws Exception {
        JSONObject o = new JSONObject().put("id", id).put("n", id).put("c", "#5B9BE0").put("ic", "x").put("d", d).put("k", k).put("s", s).put("p", 0.0).put("w", 1).put("pw", 0.5).put("r", new JSONArray());
        o.put("pid", pid == null ? JSONObject.NULL : pid);
        return o;
    }

    @Test
    public void filhosDiretosEHierarquiaProfunda() throws Exception {
        JSONObject day = WidgetModel.day(tree(), "2026-11-26");
        assertEquals(1, WidgetModel.childrenOf(day, null).size());
        assertEquals(4, WidgetModel.childrenOf(day, "semana").size());
        assertEquals(3, WidgetModel.childrenOf(day, "agua").size());
        assertEquals(0, WidgetModel.childrenOf(day, "g1").size());
    }

    @Test
    public void progressoDoGrupoAcompanhaSubmetasEmQualquerNivel() throws Exception {
        JSONObject snap = tree();
        JSONObject day = WidgetModel.day(snap, "2026-11-26");
        // Água: 3 garrafas; Semana top: 3 garrafas + cross + café + água(L) = 6 marcáveis
        double[] a0 = WidgetModel.groupProgress(day, "agua");
        assertEquals(3, (int) a0[2]);
        assertTrue(WidgetModel.setStatus(snap, "2026-11-26", "g1", "completed"));
        double[] a1 = WidgetModel.groupProgress(day, "agua");
        assertEquals(1.0 / 3, a1[0], 1e-9);
        assertEquals(1, (int) a1[1]);
        double[] s1 = WidgetModel.groupProgress(day, "semana");
        assertEquals(6, (int) s1[2]);
        assertEquals(1.0 / 6, s1[0], 1e-9);
        // marcar o grupo não altera as submetas
        assertFalse(WidgetModel.setStatus(snap, "2026-11-26", "agua", "completed"));
        assertEquals("pending", WidgetModel.findItem(day, "g2").getString("s"));
        // parcial conta o peso do app
        WidgetModel.setStatus(snap, "2026-11-26", "g2", "partial");
        assertEquals((1 + 0.5) / 3, WidgetModel.groupProgress(day, "agua")[0], 1e-9);
    }

    @Test
    public void quantidadeSegueARegraDoApp() throws Exception {
        JSONObject snap = tree();
        assertTrue(WidgetModel.setQuantity(snap, "2026-11-26", "agual", 1.5));
        JSONObject it = WidgetModel.findItem(WidgetModel.day(snap, "2026-11-26"), "agual");
        assertEquals("partial", it.getString("s"));
        assertEquals(1.5, it.getJSONObject("q").getDouble("v"), 1e-9);
        WidgetModel.setQuantity(snap, "2026-11-26", "agual", 3);
        assertEquals("completed", WidgetModel.findItem(WidgetModel.day(snap, "2026-11-26"), "agual").getString("s"));
        WidgetModel.setQuantity(snap, "2026-11-26", "agual", 0);
        assertEquals("pending", WidgetModel.findItem(WidgetModel.day(snap, "2026-11-26"), "agual").getString("s"));
        assertFalse(WidgetModel.setQuantity(snap, "2026-11-26", "agual", -1));
        assertFalse(WidgetModel.setQuantity(snap, "2026-11-26", "cross", 2)); // meta sem quantidade
    }

    @Test
    public void pendentesComQuantidadeSaoReaplicados() throws Exception {
        JSONObject snap = tree();
        JSONArray pending = new JSONArray()
                .put(new JSONObject().put("goalId", "agual").put("date", "2026-11-26").put("qty", 2.0).put("ts", 1))
                .put(new JSONObject().put("goalId", "cross").put("date", "2026-11-26").put("comment", "oi").put("id", "c1").put("ts", 2));
        WidgetModel.applyPending(snap, pending);
        assertEquals("partial", WidgetModel.findItem(WidgetModel.day(snap, "2026-11-26"), "agual").getString("s"));
        assertEquals("pending", WidgetModel.findItem(WidgetModel.day(snap, "2026-11-26"), "cross").getString("s")); // comentário não muda status
    }
}
