"use client"

import React, { createContext, useContext, useState, useMemo, ReactNode } from "react"
import {
  calculateTotalContractValue,
  calculateRemainingBudget,
  calculateCurrentProfit,
  calculateProjectedProfit,
  calculateCompletionPercent,
  calculateBudgetUsagePercent,
  determineCashflowStatus,
  type MilestoneData
} from "@/lib/financial-calculations"

// Types for project data
export interface Expense {
  id: string
  date: Date
  category: "material" | "labour" | "machinery" | "miscellaneous"
  subcategory: string
  description: string
  vendor: string
  amount: number
  paymentType: "cash" | "cheque" | "online"
  stage: string
  status: "pending" | "approved" | "rejected"
}

export interface ClientPayment {
  id: string
  stage: string
  amount: number
  date: Date
  status: "received" | "pending" | "overdue"
  mode: "cash" | "cheque" | "online"
}

export interface VendorPayment {
  id: string
  vendor: string
  amount: number
  amountPaid: number
  pendingAmount: number
  dueDate: Date
  status: "paid" | "pending" | "overdue"
}

export interface Milestone {
  id: string
  name: string
  expectedCostPercent: number
  expectedDuration: number
  actualCompletionPercent: number
  currentSpending: number
  status: "pending" | "in-progress" | "completed"
}

export interface AdditionalWork {
  id: string
  description: string
  amount: number
  approvalStatus: "pending" | "approved" | "rejected"
  clientApproval: boolean
  date: Date
}

export interface ProjectData {
  id: string
  name: string
  clientName: string
  clientPhone: string
  siteAddress: string
  projectType: "boq" | "sqft"
  startDate: Date
  expectedEndDate: Date
  
  // Financial data
  originalContractValue: number
  additionalWorksTotal: number
  totalExpenses: number
  totalClientPaymentsReceived: number
  totalVendorPaymentsDue: number
  
  // Calculated fields (auto-computed)
  revisedContractValue: number
  remainingBudget: number
  currentProfit: number
  completionPercent: number
  budgetUsagePercent: number
  
  // Lists
  expenses: Expense[]
  clientPayments: ClientPayment[]
  vendorPayments: VendorPayment[]
  milestones: Milestone[]
  additionalWorks: AdditionalWork[]
}

interface ProjectContextType {
  projectData: ProjectData
  updateExpense: (expense: Expense) => void
  addExpense: (expense: Omit<Expense, "id">) => void
  removeExpense: (id: string) => void
  updateClientPayment: (payment: ClientPayment) => void
  addClientPayment: (payment: Omit<ClientPayment, "id">) => void
  updateVendorPayment: (payment: VendorPayment) => void
  addVendorPayment: (payment: Omit<VendorPayment, "id">) => void
  updateMilestone: (milestone: Milestone) => void
  addAdditionalWork: (work: Omit<AdditionalWork, "id">) => void
  updateAdditionalWork: (work: AdditionalWork) => void
  calculatedMetrics: CalculatedMetrics
}

export interface CalculatedMetrics {
  originalContractValue: number
  additionalWorksApproved: number
  revisedContractValue: number
  totalExpenses: number
  totalClientPaymentsReceived: number
  totalClientPaymentsPending: number
  totalVendorPaymentsDue: number
  totalVendorPaymentsPaid: number
  remainingBudget: number
  currentProfit: number
  liveProfit: number
  completionPercent: number
  budgetUsagePercent: number
  cashflowStatus: "positive" | "warning" | "negative"
  nextMilestonePayment: { stage: string; amount: number } | null
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

// Sample initial data
const initialProjectData: ProjectData = {
  id: "PRJ-001",
  name: "Downtown Office Complex",
  clientName: "Apex Properties Ltd",
  clientPhone: "+91 98765 43210",
  siteAddress: "Plot 45, MG Road, Bangalore - 560001",
  projectType: "sqft",
  startDate: new Date("2024-01-15"),
  expectedEndDate: new Date("2024-12-31"),
  
  originalContractValue: 45000000, // 4.5 Cr
  additionalWorksTotal: 0,
  totalExpenses: 0,
  totalClientPaymentsReceived: 0,
  totalVendorPaymentsDue: 0,
  
  revisedContractValue: 45000000,
  remainingBudget: 45000000,
  currentProfit: 0,
  completionPercent: 0,
  budgetUsagePercent: 0,
  
  expenses: [
    { id: "EXP-001", date: new Date("2024-02-01"), category: "material", subcategory: "Cement", description: "UltraTech Cement 500 bags", vendor: "Shree Cement Dealers", amount: 350000, paymentType: "cheque", stage: "Foundation", status: "approved" },
    { id: "EXP-002", date: new Date("2024-02-05"), category: "material", subcategory: "Steel", description: "TMT Steel bars 10 tons", vendor: "Tata Steel Distributors", amount: 850000, paymentType: "online", stage: "Foundation", status: "approved" },
    { id: "EXP-003", date: new Date("2024-02-10"), category: "labour", subcategory: "Mason", description: "Mason team wages - Week 1", vendor: "Rajesh Contractors", amount: 125000, paymentType: "cash", stage: "Foundation", status: "approved" },
    { id: "EXP-004", date: new Date("2024-02-15"), category: "machinery", subcategory: "Excavator", description: "JCB Rental - 10 days", vendor: "Kumar Equipment Rentals", amount: 75000, paymentType: "cheque", stage: "Excavation", status: "approved" },
    { id: "EXP-005", date: new Date("2024-02-20"), category: "material", subcategory: "Sand", description: "River sand 50 trucks", vendor: "Local Sand Supplier", amount: 200000, paymentType: "cash", stage: "Foundation", status: "pending" },
  ],
  
  clientPayments: [
    { id: "CP-001", stage: "Booking Advance", amount: 4500000, date: new Date("2024-01-15"), status: "received", mode: "cheque" },
    { id: "CP-002", stage: "Foundation Complete", amount: 6750000, date: new Date("2024-03-01"), status: "received", mode: "online" },
    { id: "CP-003", stage: "Columns Complete", amount: 6750000, date: new Date("2024-05-15"), status: "pending", mode: "cheque" },
    { id: "CP-004", stage: "Roof Slab", amount: 9000000, date: new Date("2024-07-01"), status: "pending", mode: "online" },
  ],
  
  vendorPayments: [
    { id: "VP-001", vendor: "Shree Cement Dealers", amount: 350000, amountPaid: 350000, pendingAmount: 0, dueDate: new Date("2024-02-15"), status: "paid" },
    { id: "VP-002", vendor: "Tata Steel Distributors", amount: 850000, amountPaid: 500000, pendingAmount: 350000, dueDate: new Date("2024-03-01"), status: "pending" },
    { id: "VP-003", vendor: "Rajesh Contractors", amount: 500000, amountPaid: 125000, pendingAmount: 375000, dueDate: new Date("2024-03-15"), status: "pending" },
    { id: "VP-004", vendor: "Kumar Equipment Rentals", amount: 75000, amountPaid: 0, pendingAmount: 75000, dueDate: new Date("2024-02-28"), status: "overdue" },
  ],
  
  milestones: [
    { id: "MS-001", name: "Excavation", expectedCostPercent: 5, expectedDuration: 15, actualCompletionPercent: 100, currentSpending: 2250000, status: "completed" },
    { id: "MS-002", name: "Foundation", expectedCostPercent: 15, expectedDuration: 30, actualCompletionPercent: 100, currentSpending: 6750000, status: "completed" },
    { id: "MS-003", name: "Columns", expectedCostPercent: 15, expectedDuration: 45, actualCompletionPercent: 65, currentSpending: 4500000, status: "in-progress" },
    { id: "MS-004", name: "Roof Slab", expectedCostPercent: 20, expectedDuration: 30, actualCompletionPercent: 0, currentSpending: 0, status: "pending" },
    { id: "MS-005", name: "Brickwork", expectedCostPercent: 10, expectedDuration: 30, actualCompletionPercent: 0, currentSpending: 0, status: "pending" },
    { id: "MS-006", name: "Plastering", expectedCostPercent: 10, expectedDuration: 25, actualCompletionPercent: 0, currentSpending: 0, status: "pending" },
    { id: "MS-007", name: "Flooring", expectedCostPercent: 10, expectedDuration: 20, actualCompletionPercent: 0, currentSpending: 0, status: "pending" },
    { id: "MS-008", name: "Finishing", expectedCostPercent: 15, expectedDuration: 45, actualCompletionPercent: 0, currentSpending: 0, status: "pending" },
  ],
  
  additionalWorks: [
    { id: "AW-001", description: "Additional parking area construction", amount: 850000, approvalStatus: "approved", clientApproval: true, date: new Date("2024-02-20") },
    { id: "AW-002", description: "Garden landscaping upgrade", amount: 425000, approvalStatus: "pending", clientApproval: false, date: new Date("2024-03-05") },
  ],
}

export function ProjectProvider({ children, initialData }: { children: ReactNode; initialData?: ProjectData }) {
  const [projectData, setProjectData] = useState<ProjectData>(initialData || initialProjectData)

  // Calculate all metrics using centralized calculations
  const calculatedMetrics = useMemo<CalculatedMetrics>(() => {
    const originalContractValue = projectData.originalContractValue
    
    // Sum only approved additional works
    const additionalWorksApproved = projectData.additionalWorks
      .filter(aw => aw.approvalStatus === "approved")
      .reduce((sum, aw) => sum + aw.amount, 0)
    
    // Use centralized calculation
    const revisedContractValue = calculateTotalContractValue(originalContractValue, additionalWorksApproved)
    
    // Total approved expenses
    const totalExpenses = projectData.expenses
      .filter(exp => exp.status === "approved")
      .reduce((sum, exp) => sum + exp.amount, 0)
    
    // Client payments
    const totalClientPaymentsReceived = projectData.clientPayments
      .filter(cp => cp.status === "received")
      .reduce((sum, cp) => sum + cp.amount, 0)
    
    const totalClientPaymentsPending = projectData.clientPayments
      .filter(cp => cp.status === "pending" || cp.status === "overdue")
      .reduce((sum, cp) => sum + cp.amount, 0)
    
    // Vendor payments
    const totalVendorPaymentsDue = projectData.vendorPayments
      .reduce((sum, vp) => sum + vp.pendingAmount, 0)
    
    const totalVendorPaymentsPaid = projectData.vendorPayments
      .reduce((sum, vp) => sum + vp.amountPaid, 0)
    
    // Use centralized calculations
    const remainingBudget = calculateRemainingBudget(revisedContractValue, totalExpenses)
    const currentProfit = calculateCurrentProfit(totalClientPaymentsReceived, totalExpenses)
    const liveProfit = calculateProjectedProfit(revisedContractValue, totalExpenses)
    
    // Convert milestones for calculation
    const milestonesForCalc: MilestoneData[] = projectData.milestones.map(ms => ({
      name: ms.name,
      expectedCostPercent: ms.expectedCostPercent,
      actualCompletionPercent: ms.actualCompletionPercent,
      targetBudget: ms.currentSpending, // Using currentSpending as targetBudget
      actualExpenses: ms.currentSpending,
      status: ms.status
    }))
    
    const completionPercent = calculateCompletionPercent(milestonesForCalc)
    const budgetUsagePercent = calculateBudgetUsagePercent(totalExpenses, revisedContractValue)
    const cashflowStatus = determineCashflowStatus(currentProfit, budgetUsagePercent, completionPercent)
    
    // Next milestone payment
    const nextPendingPayment = projectData.clientPayments.find(cp => cp.status === "pending")
    const nextMilestonePayment = nextPendingPayment
      ? { stage: nextPendingPayment.stage, amount: nextPendingPayment.amount }
      : null
    
    return {
      originalContractValue,
      additionalWorksApproved,
      revisedContractValue,
      totalExpenses,
      totalClientPaymentsReceived,
      totalClientPaymentsPending,
      totalVendorPaymentsDue,
      totalVendorPaymentsPaid,
      remainingBudget,
      currentProfit,
      liveProfit,
      completionPercent,
      budgetUsagePercent,
      cashflowStatus,
      nextMilestonePayment,
    }
  }, [projectData])

  const updateExpense = (expense: Expense) => {
    setProjectData(prev => ({
      ...prev,
      expenses: prev.expenses.map(e => e.id === expense.id ? expense : e)
    }))
  }

  const addExpense = (expense: Omit<Expense, "id">) => {
    const newExpense = { ...expense, id: `EXP-${Date.now()}` }
    setProjectData(prev => ({
      ...prev,
      expenses: [...prev.expenses, newExpense]
    }))
  }

  const removeExpense = (id: string) => {
    setProjectData(prev => ({
      ...prev,
      expenses: prev.expenses.filter(e => e.id !== id)
    }))
  }

  const updateClientPayment = (payment: ClientPayment) => {
    setProjectData(prev => ({
      ...prev,
      clientPayments: prev.clientPayments.map(cp => cp.id === payment.id ? payment : cp)
    }))
  }

  const addClientPayment = (payment: Omit<ClientPayment, "id">) => {
    const newPayment = { ...payment, id: `CP-${Date.now()}` }
    setProjectData(prev => ({
      ...prev,
      clientPayments: [...prev.clientPayments, newPayment]
    }))
  }

  const updateVendorPayment = (payment: VendorPayment) => {
    setProjectData(prev => ({
      ...prev,
      vendorPayments: prev.vendorPayments.map(vp => vp.id === payment.id ? payment : vp)
    }))
  }

  const addVendorPayment = (payment: Omit<VendorPayment, "id">) => {
    const newPayment = { ...payment, id: `VP-${Date.now()}` }
    setProjectData(prev => ({
      ...prev,
      vendorPayments: [...prev.vendorPayments, newPayment]
    }))
  }

  const updateMilestone = (milestone: Milestone) => {
    setProjectData(prev => ({
      ...prev,
      milestones: prev.milestones.map(ms => ms.id === milestone.id ? milestone : ms)
    }))
  }

  const addAdditionalWork = (work: Omit<AdditionalWork, "id">) => {
    const newWork = { ...work, id: `AW-${Date.now()}` }
    setProjectData(prev => ({
      ...prev,
      additionalWorks: [...prev.additionalWorks, newWork]
    }))
  }

  const updateAdditionalWork = (work: AdditionalWork) => {
    setProjectData(prev => ({
      ...prev,
      additionalWorks: prev.additionalWorks.map(aw => aw.id === work.id ? work : aw)
    }))
  }

  return (
    <ProjectContext.Provider value={{
      projectData,
      updateExpense,
      addExpense,
      removeExpense,
      updateClientPayment,
      addClientPayment,
      updateVendorPayment,
      addVendorPayment,
      updateMilestone,
      addAdditionalWork,
      updateAdditionalWork,
      calculatedMetrics,
    }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider")
  }
  return context
}
