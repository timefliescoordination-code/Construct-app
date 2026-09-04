import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mapMilestoneName, mapProjectMilestones } from './milestone-mapper.ts'

describe('mapMilestoneName', () => {
  it('maps default catalogue names to public stages', () => {
    assert.deepEqual(mapMilestoneName('Foundation'), ['Foundation'])
    assert.deepEqual(mapMilestoneName('Plinth'), ['Plinth'])
    assert.deepEqual(mapMilestoneName('Superstructure'), ['Superstructure'])
    assert.deepEqual(mapMilestoneName('Brickwork'), ['Masonry'])
    assert.deepEqual(mapMilestoneName('Plastering'), ['Finishing'])
    assert.deepEqual(mapMilestoneName('Electrical & Plumbing'), ['Electrical', 'Plumbing'])
    assert.deepEqual(mapMilestoneName('Flooring & Tiling'), ['Flooring'])
    assert.deepEqual(mapMilestoneName('Finishing'), ['Finishing'])
  })

  it('drops custom milestone names that cannot be mapped', () => {
    assert.deepEqual(mapMilestoneName('Penthouse Lounge Fit-out'), [])
    assert.deepEqual(mapMilestoneName("Client's special pooja room package"), [])
    assert.deepEqual(mapMilestoneName('Client rooftop party deck'), [])
  })
})

describe('mapProjectMilestones', () => {
  it('returns unique stages in catalogue order and omits custom names', () => {
    const mapped = mapProjectMilestones([
      { name: 'Finishing' },
      { name: 'Foundation' },
      { name: 'Penthouse Lounge Fit-out' },
      { name: 'Foundation' },
    ])
    assert.deepEqual(mapped, ['Foundation', 'Finishing'])
    assert.equal(mapped.includes('Penthouse Lounge Fit-out' as never), false)
  })
})
