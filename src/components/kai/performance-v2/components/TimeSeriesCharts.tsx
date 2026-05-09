// DEPRECATED 2026-05-09 — TimeSeriesCharts foi substituído por MetricChartHero
// (1 chart grande com seletor de métrica, em vez de 4 pequenos).
//
// Este arquivo agora apenas re-exporta MetricChartHero como TimeSeriesCharts
// pra evitar erro caso algum import antigo escape do refactor. Pode ser
// removido com segurança quando todos os calls migrarem.
export { MetricChartHero as TimeSeriesCharts } from './MetricChartHero';
