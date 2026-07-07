# 系统间接口文档（V3 调用 V2）

## 概述

本文档描述了 V3 系统调用 V2 系统的接口列表、入参出参、鉴权方式、超时与重试策略及降级方案。

## 基础信息

| 项目 | 配置 |
|------|------|
| V2 API Base URL | 环境变量 `V2_API_BASE`（默认: `https://v2-api.example.com`） |
| 鉴权方式 | Header: `X-API-Key` |
| 超时时间 | 10 秒（环境变量 `V2_API_TIMEOUT`） |
| 最大重试次数 | 2 次（指数退避: 1s, 2s） |

## 接口列表

### 1. 校验运单是否存在 + 获取运单详情

用于发起异常上报时的真实性校验，确保不对不存在或错误运单上报异常。

```
GET /api/v2/waybills/verify?waybillNo={waybillNo}
```

**入参**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| waybillNo | string | 是 | 运单号 |

**出参**:

```json
{
  "waybillNo": "WB00000001",
  "senderName": "寄件人姓名",
  "senderAddress": "寄件人地址",
  "receiverName": "收件人姓名",
  "receiverAddress": "收件人地址",
  "totalAmount": 1000.00,
  "skuList": [
    { "skuCode": "SKU-001", "skuName": "商品A", "quantity": 2 }
  ],
  "status": "in_transit",
  "updatedAt": "2026-07-06T12:00:00Z"
}
```

### 2. 校验 SKU 是否归属于指定运单

用于扫描录入时验证该 SKU 确实在该运单的 SKU 明细中。

```
GET /api/v2/waybills/verify-sku?waybillNo={waybillNo}&skuCode={skuCode}
```

**入参**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| waybillNo | string | 是 | 运单号 |
| skuCode | string | 是 | SKU 编码 |

**出参**:

```json
{
  "valid": true
}
```

### 3. 按条件查询/同步运单列表

用于本地快照表的初始化或增量同步。

```
GET /api/v2/waybills/list?page=1&pageSize=50
```

**入参**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码，默认 1 |
| pageSize | int | 否 | 每页条数，默认 50 |

**出参**:

```json
{
  "list": [
    {
      "waybillNo": "WB00000001",
      "senderName": "...",
      "receiverName": "...",
      "totalAmount": 1000.00,
      "skuList": [...],
      "status": "in_transit",
      "updatedAt": "2026-07-06T12:00:00Z"
    }
  ],
  "total": 1000
}
```

### 4.（可选，加分项）异常处理结果回写 V2

当运单进入异常处理状态时，回写 V2 侧标记。

```
POST /api/v2/waybills/exception-status
```

**入参**:

```json
{
  "waybillNo": "WB00000001",
  "hasOpenException": true,
  "exceptionType": "damaged",
  "ticketNo": "EX250706-0001"
}
```

## 鉴权机制

所有请求需要在 Header 中传递 API Key：

```
X-API-Key: {V2_API_KEY}
```

API Key 通过环境变量 `V2_API_KEY` 配置。V2 与 V3 之间的双向鉴权均采用此方式。

## 超时与重试策略

| 项目 | 配置 |
|------|------|
| 超时时间 | 10 秒 |
| 重试次数 | 最多 2 次 |
| 重试间隔 | 首次失败等待 1 秒，第二次失败等待 2 秒（指数退避） |
| 幂等性 | 查询类接口天然幂等；写操作类接口需 V2 侧保证基于 `waybillNo` 的幂等性 |

每次调用生成唯一 `X-Request-ID`（格式: `req-{uuid}`），写入接口同步日志表。

## V2 不可用时的降级方案

| 场景 | 降级策略 |
|------|---------|
| V2 接口超时 | 提示用户"V2 接口响应超时，请稍后重试"；允许用户基于本地快照查看数据（标注"本地缓存"） |
| V2 接口返回 5xx | 重试 2 次后仍失败，提示"V2 服务暂时不可用，已记录日志" |
| V2 服务完全不可用 | 系统基于本地快照展示已有数据，所有运单信息标注"获取自 XX 时间（缓存）"；禁止发起新的异常上报和扫描操作，防止基于过期数据产生错误工单 |
| 恢复后 | V2 恢复后系统自动正常工作，无需人工介入 |

## Request ID 链路追踪

每次跨系统调用生成唯一的 `Request ID`，写入 `sync_logs` 表，包含以下字段：

| 字段 | 说明 |
|------|------|
| request_id | 唯一请求标识 |
| api_name | 调用的接口名称 |
| request_params | 请求参数摘要 |
| response_status | HTTP 响应状态码 |
| duration_ms | 请求耗时（毫秒） |
| is_success | 是否成功 |
| error_message | 错误信息（区分"V2 返回 404 运单不存在"和"网络超时"等不同类型） |

通过 Request ID 可以在日志中还原一次完整调用链，便于排查跨系统数据不一致问题。

## V2 接口新增/升级策略

### 新增接口

如果 V2 原本没有现成的对外接口，新增接口时遵循以下策略：

1. **接口版本**：URL 路径使用 `/api/v2/` 前缀，不与 V2 现有内部端点冲突
2. **不破坏现有调用方**：新接口作为独立端点新增，不改动 V2 已有的内部端点
3. **灰度上线**：先对 V3 测试环境开放，验证稳定后再全量开放

### 字段升级兼容

V2 接口字段升级时（如 `amount` 从 `int` 改为 `decimal`）：

1. **向后兼容**：如果必须修改已有字段类型，在响应中同时保留旧字段和新字段一段时间（过渡期）
2. **V3 侧感知**：V3 的 JSON 解析器对字段类型做宽容处理（如 `Number()` 转换），并在同步日志中记录字段类型变更警告
3. **主动监测**：V3 定期对比接口响应 Schema 的变更，发现未知字段或类型变化时记录告警
