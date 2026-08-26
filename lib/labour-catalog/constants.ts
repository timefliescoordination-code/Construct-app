export type LabourCatalogRoleSeed = {
  name: string
  shortLabel: string
  defaultWage: number
}

export type LabourCatalogTeamSeed = {
  name: string
  roles: LabourCatalogRoleSeed[]
}

const civilRoles: LabourCatalogRoleSeed[] = [
  { name: "Head Mason", shortLabel: "H.Msn", defaultWage: 1200 },
  { name: "Mason", shortLabel: "Mason", defaultWage: 1000 },
  { name: "Helper", shortLabel: "Helper", defaultWage: 700 },
  { name: "Sithal", shortLabel: "Sithal", defaultWage: 800 },
]

/** Company-wide labour teams and the roles that belong under each team. */
export const DEFAULT_LABOUR_CATALOG: LabourCatalogTeamSeed[] = [
  {
    name: "Civil Team",
    roles: civilRoles,
  },
  {
    name: "Tiles Team",
    roles: [
      ...civilRoles,
      { name: "Stone Cutter", shortLabel: "St.Cut", defaultWage: 950 },
    ],
  },
  {
    name: "Granite Team",
    roles: civilRoles,
  },
  {
    name: "Electrical and Plumbing Team",
    roles: [
      { name: "Head Electrician", shortLabel: "H.Elec", defaultWage: 1100 },
      { name: "Electrician", shortLabel: "Elec", defaultWage: 1000 },
      { name: "Helper", shortLabel: "Helper", defaultWage: 700 },
      { name: "Stone Cutter", shortLabel: "St.Cut", defaultWage: 950 },
    ],
  },
  {
    name: "Carpenter Team",
    roles: [
      { name: "Head Carpenter", shortLabel: "H.Carp", defaultWage: 1100 },
      { name: "Carpenter", shortLabel: "Carp", defaultWage: 900 },
    ],
  },
  {
    name: "Painter Team",
    roles: [
      { name: "Head Painter", shortLabel: "H.Pnt", defaultWage: 1000 },
      { name: "Painter", shortLabel: "Painter", defaultWage: 900 },
    ],
  },
  {
    name: "MS Work Team",
    roles: [{ name: "MS Workers", shortLabel: "MS", defaultWage: 1000 }],
  },
]

export const DEFAULT_LABOUR_TEAMS = DEFAULT_LABOUR_CATALOG.map((team) => team.name)
