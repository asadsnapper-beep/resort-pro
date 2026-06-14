/**
 * Expense routes — /api/expenses
 *
 * All routes require authentication (OWNER or MANAGER).
 *
 *   GET    /                 list expenses (filter: month, category)
 *   POST   /                 create expense
 *   PATCH  /:id              update expense
 *   DELETE /:id              delete expense
 *   GET    /summary          monthly totals by category
 *   GET    /trends           12-month expense trend + revenue comparison
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@resort-pro/database'
import { requireRole } from '../middleware/auth'
import type { JwtPayload } from '@resort-pro/types'
import dayjs from 'dayjs'

const CATEGORIES = [
  'SALARIES', 'UTILITIES', 'MAINTENANCE', 'CLEANING', 'FOOD_BEVERAGE',
  'SUPPLIES', 'MARKETING', 'INSURANCE', 'RENT', 'EQUIPMENT', 'TRANSPORTATION', 'OTHER',
] as const

const expenseSchema = z.object({
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  category:    z.enum(CATEGORIES),
  description: z.string().min(1).max(200),
  amount:      z.number().positive(),
  vendor:      z.string().max(100).optional(),
  paymentMode: z.enum(['CASH', 'BANK', 'CARD', 'OTHER']).optional(),
  notes:       z.string().max(500).optional(),
})

export async function expenseRoutes(app: FastifyInstance) {

  // ── GET / — list expenses ──────────────────────────────────────────────────
  app.get('/', {
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload
      const { month, category, page = '1', limit = '50' } = request.query as {
        month?: string      // "2026-05"
        category?: string
        page?: string
        limit?: string
      }

      const pageNum  = Math.max(1, parseInt(page))
      const pageSize = Math.min(100, Math.max(1, parseInt(limit)))

      const where: any = { tenantId }

      if (month) {
        const start = dayjs(month, 'YYYY-MM').startOf('month').toDate()
        const end   = dayjs(month, 'YYYY-MM').endOf('month').toDate()
        where.date = { gte: start, lte: end }
      }
      if (category && CATEGORIES.includes(category as any)) {
        where.category = category
      }

      const [expenses, total] = await Promise.all([
        prisma.expense.findMany({
          where,
          orderBy: { date: 'desc' },
          skip: (pageNum - 1) * pageSize,
          take: pageSize,
        }),
        prisma.expense.count({ where }),
      ])

      return reply.send({
        success: true,
        data: { expenses, total, page: pageNum, pages: Math.ceil(total / pageSize) },
      })
    },
  })

  // ── POST / — create expense ────────────────────────────────────────────────
  app.post('/', {
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId, sub } = request.user as JwtPayload
      const body = expenseSchema.parse(request.body)

      const expense = await prisma.expense.create({
        data: {
          tenantId,
          date:        new Date(body.date),
          category:    body.category,
          description: body.description,
          amount:      body.amount,
          vendor:      body.vendor,
          paymentMode: body.paymentMode,
          notes:       body.notes,
          createdBy:   sub,
        },
      })

      return reply.code(201).send({ success: true, data: expense })
    },
  })

  // ── PATCH /:id — update expense ────────────────────────────────────────────
  app.patch('/:id', {
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload
      const { id } = request.params as { id: string }

      const existing = await prisma.expense.findFirst({ where: { id, tenantId } })
      if (!existing) return reply.code(404).send({ success: false, error: 'Expense not found' })

      const body = expenseSchema.partial().parse(request.body)
      const expense = await prisma.expense.update({
        where: { id },
        data: {
          ...(body.date        && { date: new Date(body.date) }),
          ...(body.category    && { category: body.category }),
          ...(body.description && { description: body.description }),
          ...(body.amount      !== undefined && { amount: body.amount }),
          ...(body.vendor      !== undefined && { vendor: body.vendor }),
          ...(body.paymentMode !== undefined && { paymentMode: body.paymentMode }),
          ...(body.notes       !== undefined && { notes: body.notes }),
        },
      })

      return reply.send({ success: true, data: expense })
    },
  })

  // ── DELETE /:id — delete expense ───────────────────────────────────────────
  app.delete('/:id', {
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload
      const { id } = request.params as { id: string }

      const existing = await prisma.expense.findFirst({ where: { id, tenantId } })
      if (!existing) return reply.code(404).send({ success: false, error: 'Expense not found' })

      await prisma.expense.delete({ where: { id } })
      return reply.send({ success: true })
    },
  })

  // ── GET /summary — monthly totals by category ──────────────────────────────
  app.get('/summary', {
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload
      const { month } = request.query as { month?: string }

      const targetMonth = month ?? dayjs().format('YYYY-MM')
      const start = dayjs(targetMonth, 'YYYY-MM').startOf('month').toDate()
      const end   = dayjs(targetMonth, 'YYYY-MM').endOf('month').toDate()

      // Prev month for comparison
      const prevStart = dayjs(targetMonth, 'YYYY-MM').subtract(1, 'month').startOf('month').toDate()
      const prevEnd   = dayjs(targetMonth, 'YYYY-MM').subtract(1, 'month').endOf('month').toDate()

      const [byCategory, totalCurrent, totalPrev, revenue] = await Promise.all([
        // Expenses by category for the month
        prisma.expense.groupBy({
          by: ['category'],
          where: { tenantId, date: { gte: start, lte: end } },
          _sum: { amount: true },
          orderBy: { _sum: { amount: 'desc' } },
        }),
        // Total expenses this month
        prisma.expense.aggregate({
          where: { tenantId, date: { gte: start, lte: end } },
          _sum: { amount: true },
        }),
        // Total expenses prev month
        prisma.expense.aggregate({
          where: { tenantId, date: { gte: prevStart, lte: prevEnd } },
          _sum: { amount: true },
        }),
        // Revenue this month (for profit calculation)
        prisma.payment.aggregate({
          where: { tenantId, processedAt: { gte: start, lte: end }, status: 'PAID' },
          _sum: { amount: true },
        }),
      ])

      const totalExpenses = Number(totalCurrent._sum.amount ?? 0)
      const prevExpenses  = Number(totalPrev._sum.amount ?? 0)
      const totalRevenue  = Number(revenue._sum.amount ?? 0)
      const profit        = totalRevenue - totalExpenses
      const profitMargin  = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0
      const expenseGrowth = prevExpenses > 0
        ? Math.round(((totalExpenses - prevExpenses) / prevExpenses) * 100)
        : 0

      return reply.send({
        success: true,
        data: {
          month:         targetMonth,
          totalExpenses,
          prevExpenses,
          expenseGrowth,
          totalRevenue,
          profit,
          profitMargin,
          byCategory: byCategory.map(c => ({
            category: c.category,
            amount:   Number(c._sum.amount ?? 0),
          })),
        },
      })
    },
  })

  // ── GET /trends — 12-month expense + revenue trend ─────────────────────────
  app.get('/trends', {
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload

      // Last 12 months
      const months: { label: string; start: Date; end: Date }[] = []
      for (let i = 11; i >= 0; i--) {
        const m = dayjs().subtract(i, 'month')
        months.push({
          label: m.format('MMM YY'),
          start: m.startOf('month').toDate(),
          end:   m.endOf('month').toDate(),
        })
      }

      const trends = await Promise.all(
        months.map(async ({ label, start, end }) => {
          const [expenses, payments] = await Promise.all([
            prisma.expense.aggregate({
              where: { tenantId, date: { gte: start, lte: end } },
              _sum: { amount: true },
            }),
            prisma.payment.aggregate({
              where: { tenantId, processedAt: { gte: start, lte: end }, status: 'PAID' },
              _sum: { amount: true },
            }),
          ])

          const exp = Number(expenses._sum.amount ?? 0)
          const rev = Number(payments._sum.amount ?? 0)
          return { month: label, expenses: exp, revenue: rev, profit: rev - exp }
        })
      )

      return reply.send({ success: true, data: trends })
    },
  })
}
