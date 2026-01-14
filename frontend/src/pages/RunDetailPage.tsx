// RunDetailPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiService, RunSummary, RunDetail } from '../services/api'
import './RunDetailPage.css'

type TabType = 'summary' | 'mismatches' | 'all' | 'errors'

// Si tu backend devuelve config dentro de getRun(), lo mostramos.
// Si todavía no está tipado en RunSummary, lo leemos de forma segura.
type RunWithConfig = RunSummary & {
  config?: Record<string, any>
  completed_at?: string | null
}

function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()

  const [run, setRun] = useState<RunWithConfig | null>(null)
  const [details, setDetails] = useState<RunDetail[]>([])

  // Loading separado para no “bloquear” toda la pantalla
  const [loadingRun, setLoadingRun] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState(true)

  // Polling visual “suave”
  const [isPolling, setIsPolling] = useState(false)

  const [activeTab, setActiveTab] = useState<TabType>('summary')
  const [selectedCase, setSelectedCase] = useState<RunDetail | null>(null)
  const [commentForm, setCommentForm] = useState({
    comment: '',
    tag: '',
    reviewed: false,
  })

  // UI config panel
  const [showConfig, setShowConfig] = useState(false)
  const [copyOk, setCopyOk] = useState(false)

  const filterForApi = useMemo(() => {
    if (activeTab === 'summary') return undefined
    if (activeTab === 'all') return 'all'
    return activeTab
  }, [activeTab])

  // Carga inicial / cambio de tab
  useEffect(() => {
    if (!runId) return
    void loadRun(false)
    void loadDetails(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, activeTab])

  // Polling cuando está running: refresca run + details, sin bloquear la tabla
  useEffect(() => {
    if (!runId) return
    if (!run) return
    if (run.status !== 'running') return

    const interval = setInterval(() => {
      setIsPolling(true)
      void loadRun(true)
      void loadDetails(true)
    }, 2000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, run?.status, filterForApi])

  useEffect(() => {
    if (!isPolling) return
    const t = setTimeout(() => setIsPolling(false), 350)
    return () => clearTimeout(t)
  }, [isPolling])

  const loadRun = async (silent: boolean) => {
    if (!runId) return
    try {
      if (!silent) setLoadingRun(true)
      const data = (await apiService.getRun(runId)) as RunWithConfig
      setRun(data)
    } catch (error) {
      console.error('Error loading run:', error)
      if (!silent) alert('Error al cargar run')
    } finally {
      if (!silent) setLoadingRun(false)
    }
  }

  const loadDetails = async (silent: boolean) => {
    if (!runId) return
    try {
      if (!silent) setLoadingDetails(true)
      const data = await apiService.getRunDetails(runId, filterForApi as any)
      setDetails(data)
    } catch (error) {
      console.error('Error loading details:', error)
      if (!silent) alert('Error al cargar detalles')
    } finally {
      if (!silent) setLoadingDetails(false)
    }
  }

  const handleExportCSV = async () => {
    if (!runId) return
    try {
      const blob = await apiService.exportCSV(runId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `run_${runId}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error exporting CSV:', error)
      alert('Error al exportar CSV')
    }
  }

  const handleSaveComment = async () => {
    if (!runId || !selectedCase) return
    try {
      await apiService.addComment(runId, selectedCase.case_id, commentForm)
      setSelectedCase(null)
      setCommentForm({ comment: '', tag: '', reviewed: false })

      // refresco “suave”: no bloqueamos la tabla
      void loadDetails(true)
      void loadRun(true)
    } catch (error) {
      console.error('Error saving comment:', error)
      alert('Error al guardar comentario')
    }
  }

  const openCaseDetail = (detail: RunDetail) => {
    setSelectedCase(detail)
    setCommentForm({
      comment: detail.comment || '',
      tag: detail.tag || '',
      reviewed: !!detail.reviewed,
    })
  }

  const formatPercent = (value: number | null) => {
    if (value === null) return '-'
    return `${(value * 100).toFixed(1)}%`
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('es-ES')
  }

  const configJson = useMemo(() => {
    const cfg = run?.config ?? {}
    try {
      return JSON.stringify(cfg, null, 2)
    } catch {
      return String(cfg)
    }
  }, [run?.config])

  const hasConfig = useMemo(() => {
    const cfg = run?.config
    return cfg && typeof cfg === 'object' && Object.keys(cfg).length > 0
  }, [run?.config])

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(configJson)
      setCopyOk(true)
      setTimeout(() => setCopyOk(false), 1200)
    } catch (e) {
      console.error('Clipboard error:', e)
      alert('No se pudo copiar al portapapeles')
    }
  }

  if (loadingRun && !run) {
    return <div className="loading">Cargando...</div>
  }

  if (!run) {
    return <div className="loading">No se encontró el run</div>
  }

  return (
    <div className="run-detail-page">
      <div className="detail-header">
        <button className="btn btn-sm" onClick={() => navigate('/')}>
          ← Volver
        </button>

        <div className="detail-title">
          <h1>Run: {run.run_id.substring(0, 8)}...</h1>
          <div className="detail-subtitle">
            <span className={`status status-${run.status}`}>{run.status}</span>
            <span className="muted">•</span>
            <span className="muted">Creado: {formatDate(run.created_at)}</span>
            {run.completed_at && (
              <>
                <span className="muted">•</span>
                <span className="muted">Fin: {formatDate(run.completed_at)}</span>
              </>
            )}
            {isPolling && (
              <>
                <span className="muted">•</span>
                <span className="polling-indicator">
                  <span className="mini-spinner" /> Actualizando…
                </span>
              </>
            )}
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleExportCSV}>
          Exportar CSV
        </button>
      </div>

      <div className="metrics-panel">
        <div className="metric">
          <div className="metric-label">Accuracy</div>
          <div className="metric-value">{formatPercent(run.accuracy)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Coverage</div>
          <div className="metric-value">{formatPercent(run.coverage)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Error Rate</div>
          <div className="metric-value">{formatPercent(run.error_rate)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Total Casos</div>
          <div className="metric-value">{run.total_cases}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Mismatches</div>
          <div className="metric-value">{run.mismatches}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Errores</div>
          <div className="metric-value">{run.errors}</div>
        </div>
      </div>

      {/* Config panel */}
      <div className="config-panel">
        <div className="config-panel-header">
          <div className="config-panel-title">
            <h3>Configuración</h3>
            <span className="muted">
              Plugin: <strong>{run.plugin_name}</strong>
            </span>
          </div>

          <div className="config-panel-actions">
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => setShowConfig((v) => !v)}
            >
              {showConfig ? 'Ocultar' : 'Mostrar'}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={handleCopyConfig}
              disabled={!hasConfig}
              title={hasConfig ? 'Copiar JSON al portapapeles' : 'No hay config'}
            >
              {copyOk ? 'Copiado ✓' : 'Copiar JSON'}
            </button>
          </div>
        </div>

        {showConfig && (
          <div className="config-panel-body">
            {!hasConfig ? (
              <div className="muted">Este run no tiene config (vacío).</div>
            ) : (
              <pre className="config-pre">{configJson}</pre>
            )}
          </div>
        )}
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Resumen
        </button>
        <button
          className={`tab ${activeTab === 'mismatches' ? 'active' : ''}`}
          onClick={() => setActiveTab('mismatches')}
        >
          Mismatches ({run.mismatches})
        </button>
        <button
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          Todos ({run.total_cases})
        </button>
        <button
          className={`tab ${activeTab === 'errors' ? 'active' : ''}`}
          onClick={() => setActiveTab('errors')}
        >
          Errores ({run.errors})
        </button>
      </div>

      {loadingDetails ? (
        <div className="loading">Cargando...</div>
      ) : (
        <div className="details-table-container">
          <table className="details-table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Truth</th>
                <th>Pred</th>
                <th>Match</th>
                <th>Status</th>
                <th>Revisado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {details.map((detail) => (
                <tr key={detail.case_id}>
                  <td className="case-id">{detail.case_id}</td>
                  <td>{detail.truth || '-'}</td>
                  <td>{detail.pred_value || '-'}</td>
                  <td>
                    <span className={detail.match ? 'match-yes' : 'match-no'}>
                      {detail.match ? '✓' : '✗'}
                    </span>
                  </td>
                  <td>
                    <span className={`status status-${detail.pred_status}`}>
                      {detail.pred_status}
                    </span>
                  </td>
                  <td>{detail.reviewed ? '✓' : '-'}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => openCaseDetail(detail)}>
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
              {details.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    No hay casos para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedCase && (
        <div className="modal-overlay" onClick={() => setSelectedCase(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalle del Caso: {selectedCase.case_id}</h2>
              <button className="btn-close" onClick={() => setSelectedCase(null)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h3>Datos del Caso</h3>
                <pre>{JSON.stringify(selectedCase.case_data, null, 2)}</pre>
              </div>

              <div className="detail-section">
                <h3>Comparación</h3>
                <div className="comparison">
                  <div>
                    <strong>Truth:</strong> {selectedCase.truth || '-'}
                  </div>
                  <div>
                    <strong>Pred:</strong> {selectedCase.pred_value || '-'}
                  </div>
                  <div>
                    <strong>Match:</strong>{' '}
                    <span className={selectedCase.match ? 'match-yes' : 'match-no'}>
                      {selectedCase.match ? 'Sí' : 'No'}
                    </span>
                  </div>
                  {selectedCase.mismatch_reason && (
                    <div>
                      <strong>Razón:</strong> {selectedCase.mismatch_reason}
                    </div>
                  )}
                </div>
              </div>

              {selectedCase.raw && (
                <div className="detail-section">
                  <h3>Raw Response</h3>
                  <pre>{selectedCase.raw}</pre>
                </div>
              )}

              {selectedCase.meta && Object.keys(selectedCase.meta).length > 0 && (
                <div className="detail-section">
                  <h3>Metadata</h3>
                  <pre>{JSON.stringify(selectedCase.meta, null, 2)}</pre>
                </div>
              )}

              <div className="detail-section">
                <h3>Comentarios</h3>
                <div className="comment-form">
                  <div className="form-group">
                    <label>Comentario:</label>
                    <textarea
                      value={commentForm.comment}
                      onChange={(e) => setCommentForm({ ...commentForm, comment: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="form-group">
                    <label>Tag:</label>
                    <input
                      type="text"
                      value={commentForm.tag}
                      onChange={(e) => setCommentForm({ ...commentForm, tag: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={commentForm.reviewed}
                        onChange={(e) => setCommentForm({ ...commentForm, reviewed: e.target.checked })}
                      />
                      Revisado
                    </label>
                  </div>

                  <button className="btn btn-primary" onClick={handleSaveComment}>
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RunDetailPage
