"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Upload, Plus, X, Calendar, Building2, Users, FileSpreadsheet, IndianRupee, Percent } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import Link from "next/link"
import { calculateFormSummary } from "@/lib/financial-calculations"
import { createProjectAction } from "@/lib/projects/actions"
import { toast } from "sonner"
import { useStaffProfiles } from "@/lib/hooks/use-staff-profiles"
import { PM_NOT_CREATED, SITE_ENGINEER_NOT_CREATED, CUSTOMER_NOT_CREATED } from "@/lib/staff-labels"

type ProjectType = "boq" | "contract"

export function CreateProjectForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { projectManagers, siteEngineers, customers, isLoading: staffLoading } = useStaffProfiles()
  
  // Basic Info
  const [projectName, setProjectName] = useState("")
  const [clientName, setClientName] = useState("")
  const [phone, setPhone] = useState("")
  const [siteAddress, setSiteAddress] = useState("")
  const [startDate, setStartDate] = useState<Date>()
  const [expectedEndDate, setExpectedEndDate] = useState<Date>()
  
  // Project Type
  const [projectType, setProjectType] = useState<ProjectType>("contract")
  
  // Contract Value Fields
  const [contractValue, setContractValue] = useState("")
  const [additionalWorks, setAdditionalWorks] = useState("")
  const [expectedMargin, setExpectedMargin] = useState("")
  
  // BOQ Fields
  const [boqFile, setBoqFile] = useState<File | null>(null)
  const [manualBoqEntries, setManualBoqEntries] = useState<Array<{ item: string; quantity: string; rate: string }>>([
    { item: "", quantity: "", rate: "" }
  ])
  
  // Staff Assignment
  const [assignedCustomer, setAssignedCustomer] = useState("")
  const [assignedPM, setAssignedPM] = useState("")
  const [assignedEngineers, setAssignedEngineers] = useState<string[]>([])

  const handleCustomerChange = (customerId: string) => {
    setAssignedCustomer(customerId)
    const customer = customers.find((c) => c.id === customerId)
    if (customer) {
      if (customer.full_name?.trim()) {
        setClientName(customer.full_name)
      }
      if (customer.phone?.trim()) {
        setPhone(customer.phone)
      }
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setBoqFile(file)
    }
  }

  const addBoqEntry = () => {
    setManualBoqEntries([...manualBoqEntries, { item: "", quantity: "", rate: "" }])
  }

  const removeBoqEntry = (index: number) => {
    setManualBoqEntries(manualBoqEntries.filter((_, i) => i !== index))
  }

  const updateBoqEntry = (index: number, field: string, value: string) => {
    const updated = [...manualBoqEntries]
    updated[index] = { ...updated[index], [field]: value }
    setManualBoqEntries(updated)
  }

  const toggleEngineer = (engineerId: string) => {
    setAssignedEngineers(prev => 
      prev.includes(engineerId)
        ? prev.filter(id => id !== engineerId)
        : [...prev, engineerId]
    )
  }

  // Use centralized calculations
  const formSummary = calculateFormSummary(contractValue, additionalWorks, expectedMargin)
  
  const calculateEstimate = () => {
    if (projectType === "contract") {
      return formSummary.totalContractValue
    }
    if (projectType === "boq") {
      return manualBoqEntries.reduce((total, entry) => {
        const qty = parseFloat(entry.quantity) || 0
        const rate = parseFloat(entry.rate) || 0
        return total + (qty * rate)
      }, 0)
    }
    return 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      const result = await createProjectAction({
        name: projectName,
        client_name: clientName,
        site_address: siteAddress,
        contract_value: parseFloat(contractValue) || 0,
        additional_works_value: parseFloat(additionalWorks) || 0,
        expected_margin_percent: parseFloat(expectedMargin) || 15,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        expected_completion_date: expectedEndDate
          ? format(expectedEndDate, "yyyy-MM-dd")
          : null,
        pm_id: assignedPM || null,
        customer_id: assignedCustomer || null,
        stage_budget: formSummary.stageBudget,
        assigned_engineer_ids: assignedEngineers,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success("Project created successfully!")
      router.push(`/projects/${result.projectId}`)
    } catch (error) {
      console.error("[create-project] error:", error)
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create a Project</h1>
          <p className="text-muted-foreground">Fill in the details to create a new construction project</p>
        </div>
      </div>

      {/* Basic Info */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Basic Info</CardTitle>
          </div>
          <CardDescription>Enter the basic project information</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              placeholder="Enter project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientName">Client Name</Label>
            <Input
              id="clientName"
              placeholder="Enter client name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="siteAddress">Site Address</Label>
            <Textarea
              id="siteAddress"
              placeholder="Enter the complete site address"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Expected End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expectedEndDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {expectedEndDate ? format(expectedEndDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={expectedEndDate}
                  onSelect={setExpectedEndDate}
                  initialFocus
                  disabled={(date) => startDate ? date < startDate : false}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Project Type */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <CardTitle>Project Type</CardTitle>
          </div>
          <CardDescription>Select how you want to estimate this project</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={projectType}
            onValueChange={(value) => setProjectType(value as ProjectType)}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Label
              htmlFor="contract"
              className={cn(
                "flex items-center gap-4 rounded-lg border-2 p-4 cursor-pointer transition-all",
                projectType === "contract"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <RadioGroupItem value="contract" id="contract" />
              <div>
                <p className="font-medium text-foreground">Contract Based</p>
                <p className="text-sm text-muted-foreground">
                  Enter contract value and expected margin
                </p>
              </div>
            </Label>
            <Label
              htmlFor="boq"
              className={cn(
                "flex items-center gap-4 rounded-lg border-2 p-4 cursor-pointer transition-all",
                projectType === "boq"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <RadioGroupItem value="boq" id="boq" />
              <div>
                <p className="font-medium text-foreground">BOQ Based</p>
                <p className="text-sm text-muted-foreground">
                  Upload or enter Bill of Quantities
                </p>
              </div>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Contract Details */}
      {projectType === "contract" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-primary" />
              <CardTitle>Contract Details</CardTitle>
            </div>
            <CardDescription>Enter contract value and expected profit margin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Total Contract Value */}
            <div className="space-y-3">
              <Label htmlFor="contractValue">Total Contract Value (₹) <span className="text-destructive">*</span></Label>
              <Input
                id="contractValue"
                type="number"
                placeholder="e.g., 45000000"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
              />
            </div>

            {/* Additional Works */}
            <div className="space-y-3">
              <Label htmlFor="additionalWorks">Additional Works (₹)</Label>
              <Input
                id="additionalWorks"
                type="number"
                placeholder="e.g., 850000"
                value={additionalWorks}
                onChange={(e) => setAdditionalWorks(e.target.value)}
              />
            </div>

            {/* Expected Margin */}
            <div className="space-y-3">
              <Label htmlFor="expectedMargin" className="flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Expected Profit Margin (%) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="expectedMargin"
                type="number"
                placeholder="e.g., 15"
                value={expectedMargin}
                onChange={(e) => setExpectedMargin(e.target.value)}
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                This margin will be used for profit calculations across all dashboards
              </p>
            </div>

            {/* Summary */}
            {contractValue && (
              <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
                <p className="text-sm font-medium text-foreground">Project Summary</p>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contract Value</span>
                    <span className="font-medium">₹{(parseFloat(contractValue) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                  {additionalWorks && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Additional Works</span>
                      <span className="font-medium">₹{(parseFloat(additionalWorks) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground">Total Contract Value</span>
                    <span className="font-bold">₹{formSummary.totalContractValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                  {expectedMargin && (
                    <>
                      <div className="flex justify-between text-green-500">
                        <span>Expected Profit ({expectedMargin}%)</span>
                        <span className="font-medium">₹{formSummary.expectedProfitAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-2">
                        <span className="text-muted-foreground">Stage Budget (for expenses)</span>
                        <span className="font-bold text-primary">₹{formSummary.stageBudget.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* BOQ Project Fields */}
      {projectType === "boq" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>BOQ Project Details</CardTitle>
            <CardDescription>Upload a BOQ file or enter items manually</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload */}
            <div className="space-y-2">
              <Label>Upload BOQ File</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="boqFile"
                />
                <label htmlFor="boqFile" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  {boqFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm text-foreground">{boqFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          setBoqFile(null)
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Excel or CSV files supported
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* Manual BOQ Entry */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Manual BOQ Entry</Label>
                <Button type="button" variant="outline" size="sm" onClick={addBoqEntry}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              <div className="space-y-3">
                {manualBoqEntries.map((entry, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <div className="flex-1 grid gap-3 sm:grid-cols-3">
                      <Input
                        placeholder="Item description"
                        value={entry.item}
                        onChange={(e) => updateBoqEntry(index, "item", e.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="Quantity"
                        value={entry.quantity}
                        onChange={(e) => updateBoqEntry(index, "quantity", e.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="Rate (Rs)"
                        value={entry.rate}
                        onChange={(e) => updateBoqEntry(index, "rate", e.target.value)}
                      />
                    </div>
                    {manualBoqEntries.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBoqEntry(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {calculateEstimate() > 0 && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground">Estimated Project Value</p>
                  <p className="text-2xl font-bold text-primary">
                    Rs {calculateEstimate().toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff Assignment */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Staff Assignment</CardTitle>
          </div>
          <CardDescription>
            Each person only sees projects they are assigned here. Unassigned users see nothing for that role.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Assign Customer</Label>
            {staffLoading ? (
              <p className="text-sm text-muted-foreground">Loading customers...</p>
            ) : customers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground">{CUSTOMER_NOT_CREATED}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create a customer user in Admin → User Management first.
                </p>
              </div>
            ) : (
              <Select value={assignedCustomer} onValueChange={handleCustomerChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.full_name || customer.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>Project Manager</Label>
            {staffLoading ? (
              <p className="text-sm text-muted-foreground">Loading project managers...</p>
            ) : projectManagers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground">{PM_NOT_CREATED}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create a PM user in Admin → User Management first.
                </p>
              </div>
            ) : (
              <Select value={assignedPM} onValueChange={setAssignedPM}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Project Manager" />
                </SelectTrigger>
                <SelectContent>
                  {projectManagers.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>
                      {pm.full_name || pm.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Site Engineers</Label>
            {staffLoading ? (
              <p className="text-sm text-muted-foreground">Loading site engineers...</p>
            ) : siteEngineers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground">{SITE_ENGINEER_NOT_CREATED}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create a site engineer user in Admin → User Management first.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {siteEngineers.map((engineer) => (
                    <Badge
                      key={engineer.id}
                      variant={assignedEngineers.includes(engineer.id) ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer transition-all",
                        assignedEngineers.includes(engineer.id)
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-primary/10"
                      )}
                      onClick={() => toggleEngineer(engineer.id)}
                    >
                      {engineer.full_name || engineer.email}
                      {assignedEngineers.includes(engineer.id) && (
                        <X className="h-3 w-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
                {assignedEngineers.length === 0 && (
                  <p className="text-xs text-muted-foreground">Click on site engineers to assign them</p>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" asChild>
          <Link href="/projects">Cancel</Link>
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating Project..." : "Create Project"}
        </Button>
      </div>
    </form>
  )
}
