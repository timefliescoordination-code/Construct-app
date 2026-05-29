export const DEFAULT_EXPENSE_CATEGORIES = [
  {
    name: "Materials",
    usesLabourTeams: false,
    subcategories: [
      "Cement",
      "Steel",
      "Sand",
      "Bricks",
      "Tiles",
      "Paint",
      "Plumbing",
      "Electrical",
    ],
  },
  {
    name: "Labour",
    usesLabourTeams: true,
    subcategories: [],
  },
  {
    name: "Equipment",
    usesLabourTeams: false,
    subcategories: ["Excavator", "Crane", "Mixer", "Compactor", "Generator"],
  },
  {
    name: "Miscellaneous",
    usesLabourTeams: false,
    subcategories: [
      "Transportation",
      "Permits",
      "Insurance",
      "Utilities",
      "Other",
    ],
  },
] as const
