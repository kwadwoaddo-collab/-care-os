import { expect, test } from 'vitest'
import { calculateCompliance, ComplianceDocument } from '@/lib/compliance/calculateCompliance'

// Helper to construct a mock document
function makeDoc(
  id: string,
  type: string,
  status: 'approved' | 'pending' | 'rejected' = 'approved',
  category?: string
): ComplianceDocument {
  return {
    id,
    document_type: type,
    training_category: category ?? null,
    reviewed_status: status,
    expiry_date: null,
    file_name: 'test.pdf',
    issue_date: null,
    created_at: new Date().toISOString(),
  }
}

test('requirements logic: calculates missing, pending, and approved correctly', () => {
  const docs: ComplianceDocument[] = [
    // Approved manual handling
    makeDoc('1', 'training_certificate', 'approved', 'manual_handling'),
    // Pending safeguarding
    makeDoc('2', 'training_certificate', 'pending', 'safeguarding'),
    // Rejected basic life support
    makeDoc('3', 'training_certificate', 'rejected', 'basic_life_support'),
    // Pending basic life support (newer upload)
    makeDoc('4', 'training_certificate', 'pending', 'basic_life_support'),
  ]

  const compliance = calculateCompliance(docs)

  // Expected logic from the route:
  // approvedCategories = compliance.satisfiedTraining
  // pendingCategories = categories with pending status AND not in satisfiedTraining
  // missingCategories = requiredTraining - satisfiedTraining - pendingCategories

  const approvedCategories = compliance.satisfiedTraining
  const approvedSet = new Set(approvedCategories)

  const pendingMap = new Map<string, boolean>()
  for (const d of docs) {
    if (d.document_type === 'training_certificate' && d.training_category && d.reviewed_status === 'pending') {
      pendingMap.set(d.training_category, true)
    }
  }

  const requiredTraining = ['manual_handling', 'safeguarding', 'basic_life_support', 'health_safety']
  
  const pendingCategories: string[] = []
  for (const cat of requiredTraining) {
    if (!approvedSet.has(cat) && pendingMap.has(cat)) {
      pendingCategories.push(cat)
    }
  }

  const pendingSet = new Set(pendingCategories)
  const missingCategories = requiredTraining.filter(
    (cat) => !approvedSet.has(cat) && !pendingSet.has(cat)
  )

  expect(approvedCategories).toContain('manual_handling')
  expect(pendingCategories).toContain('safeguarding')
  expect(pendingCategories).toContain('basic_life_support')
  expect(missingCategories).toContain('health_safety')

  // Make sure basic life support is not missing, just pending
  expect(missingCategories).not.toContain('basic_life_support')
})
