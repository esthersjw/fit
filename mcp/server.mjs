#!/usr/bin/env node
// 身体课表 MCP server (stdio, zero dependencies, read-only).
// Env: FIT_SUPABASE_URL, FIT_SUPABASE_KEY (public anon key), FIT_TOKEN (the key made in the app → 账号与数据 → 连接我的 Agent)
import { createInterface } from 'node:readline'

const { FIT_SUPABASE_URL: URL_, FIT_SUPABASE_KEY: KEY, FIT_TOKEN: TOKEN } = process.env

const TOOLS = [
  {
    name: 'get_fitness_progress',
    description:
      '读取用户在「身体课表」里的健身进度（只读）：本周和下周课表、完成情况、最近 4 周训练分钟数、体重 7 天平均趋势、最近 7 天手掌法饮食。返回一份 Markdown 周报和结构化 JSON。这些是事实记录，不是考核：不要催促或打分，体重只谈 7 天平均趋势。',
    inputSchema: {
      type: 'object',
      properties: { include_raw_data: { type: 'boolean', description: '同时返回完整原始数据（卡片库、所有课表、所有记录）。默认 false。' } },
    },
  },
]

async function progress(includeRaw) {
  if (!URL_ || !KEY || !TOKEN) throw new Error('缺少环境变量 FIT_SUPABASE_URL / FIT_SUPABASE_KEY / FIT_TOKEN')
  const res = await fetch(`${URL_}/rest/v1/rpc/agent_summary`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: TOKEN, include_data: !!includeRaw }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.message || `HTTP ${res.status}`)
  if (!body.summary) return '还没有同步过数据：先在手机或电脑上登录身体课表。'
  const { markdown, ...facts } = body.summary
  return `${markdown}\n\n---\n数据更新于 ${body.updated_at}\n\n\`\`\`json\n${JSON.stringify(includeRaw ? { ...facts, raw: body.data } : facts, null, 2)}\n\`\`\``
}

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n')

async function handle(req) {
  const { id, method, params } = req
  if (method === 'initialize')
    return { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'fit-hiesther', version: '1.0.0' } }
  if (method === 'tools/list') return { tools: TOOLS }
  if (method === 'tools/call') {
    if (params?.name !== 'get_fitness_progress') throw Object.assign(new Error(`unknown tool ${params?.name}`), { code: -32602 })
    try {
      return { content: [{ type: 'text', text: await progress(params.arguments?.include_raw_data) }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `读取失败：${e.message}` }], isError: true }
    }
  }
  if (method === 'ping') return {}
  if (id === undefined) return undefined // notifications
  throw Object.assign(new Error(`method not found: ${method}`), { code: -32601 })
}

createInterface({ input: process.stdin }).on('line', async (line) => {
  if (!line.trim()) return
  let req
  try {
    req = JSON.parse(line)
  } catch {
    return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } })
  }
  try {
    const result = await handle(req)
    if (req.id !== undefined && result !== undefined) send({ jsonrpc: '2.0', id: req.id, result })
  } catch (e) {
    if (req.id !== undefined) send({ jsonrpc: '2.0', id: req.id, error: { code: e.code ?? -32603, message: e.message } })
  }
})
