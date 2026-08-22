export interface ChemicalHoldingDeleteHoldingInput {
  readonly id: string
  readonly productId: string
  readonly unitId: string
}

export interface ChemicalHoldingDeleteProductInput {
  readonly id: string
  readonly canonicalName: string
}

export interface ChemicalHoldingDeleteUnitInput {
  readonly id: string
  readonly nameTh: string
}

export interface ChemicalHoldingDeleteVersionInput {
  readonly id: string
  readonly productId: string
  readonly sourceHoldingId: string | null
  readonly status: string
  readonly revisionLabel: string | null
  readonly fileId: string | null
}

export interface ChemicalHoldingDeletePublicationInput {
  readonly id: string
  readonly productId?: string
  readonly sourceHoldingId: string
  readonly sdsVersionId: string
  readonly destination: 'room' | 'department'
  readonly departmentCode: string | null
  readonly displayName: string
  readonly status: string
}

export interface ChemicalHoldingDeleteLinkInput {
  readonly id: string
  readonly departmentSdsId: string
  readonly productId: string
  readonly holdingId: string
  readonly sdsVersionId: string | null
}

export interface ChemicalHoldingDeleteDepartmentSdsInput {
  readonly id: string
  readonly departmentCode: string
  readonly displayName: string
  readonly fileId: string
}

export interface ChemicalHoldingDeleteFileInput {
  readonly id: string
  readonly fileName: string
  readonly r2Key: string
}

export interface ChemicalHoldingDeletePlannerInput {
  readonly holding: ChemicalHoldingDeleteHoldingInput
  readonly product: ChemicalHoldingDeleteProductInput | null
  readonly unit: ChemicalHoldingDeleteUnitInput | null
  readonly versions: readonly ChemicalHoldingDeleteVersionInput[]
  readonly publications: readonly ChemicalHoldingDeletePublicationInput[]
  readonly links: readonly ChemicalHoldingDeleteLinkInput[]
  readonly departmentSds: readonly ChemicalHoldingDeleteDepartmentSdsInput[]
  readonly files: readonly ChemicalHoldingDeleteFileInput[]
  readonly holdingLabels?: Readonly<Record<string, string>>
}

export type ChemicalHoldingDeleteDependencyKind = 'version' | 'publication' | 'department_link'

export interface ChemicalHoldingDeleteDependency {
  readonly kind: ChemicalHoldingDeleteDependencyKind
  readonly sdsVersionId: string
  readonly relatedHoldingId: string
  readonly relatedHoldingLabel: string
  readonly relatedRowId: string
  readonly destination: 'room' | 'department' | null
  readonly departmentCode: string | null
  readonly label: string
}

export interface ChemicalHoldingDeleteVersionSummary {
  readonly id: string
  readonly status: string
  readonly revisionLabel: string | null
  readonly fileId: string | null
  readonly willDelete: boolean
}

export interface ChemicalHoldingDeletePublicationSummary {
  readonly id: string
  readonly sdsVersionId: string
  readonly sourceHoldingId: string
  readonly destination: 'room' | 'department'
  readonly departmentCode: string | null
  readonly displayName: string
  readonly status: string
}

export interface ChemicalHoldingDeleteLinkSummary {
  readonly id: string
  readonly departmentSdsId: string
  readonly sdsVersionId: string | null
}

export interface ChemicalHoldingDeleteDepartmentSdsSummary {
  readonly id: string
  readonly departmentCode: string
  readonly displayName: string
  readonly fileId: string
  readonly willDelete: boolean
}

export interface ChemicalHoldingDeleteFileSummary {
  readonly id: string
  readonly fileName: string
  readonly r2Key: string
  readonly reason?: string
}

export interface ChemicalHoldingDeletePlan {
  readonly publicationIds: string[]
  readonly departmentLinkIds: string[]
  readonly departmentSdsIds: string[]
  readonly sdsVersionIds: string[]
  readonly fileIds: string[]
  readonly fileKeys: string[]
}

export interface ChemicalHoldingDeleteImpact {
  readonly holdingId: string
  readonly productId: string
  readonly unitId: string
  readonly productName: string
  readonly unitName: string
  readonly canDelete: boolean
  readonly versions: ChemicalHoldingDeleteVersionSummary[]
  readonly publications: ChemicalHoldingDeletePublicationSummary[]
  readonly departmentLinks: ChemicalHoldingDeleteLinkSummary[]
  readonly departmentSds: ChemicalHoldingDeleteDepartmentSdsSummary[]
  readonly sharedDependencies: ChemicalHoldingDeleteDependency[]
  readonly filesToDelete: ChemicalHoldingDeleteFileSummary[]
  readonly filesToKeep: ChemicalHoldingDeleteFileSummary[]
  readonly deletePlan: ChemicalHoldingDeletePlan
  readonly productIdsPreserved: string[]
  readonly holdingIdsPreserved: string[]
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function includesId(ids: readonly string[], value: string | null): boolean {
  return value !== null && ids.includes(value)
}

function fileSummary(
  file: ChemicalHoldingDeleteFileInput,
  reason?: string,
): ChemicalHoldingDeleteFileSummary {
  return reason ? { id: file.id, fileName: file.fileName, r2Key: file.r2Key, reason } : {
    id: file.id,
    fileName: file.fileName,
    r2Key: file.r2Key,
  }
}

export function buildChemicalHoldingDeleteImpact(
  input: ChemicalHoldingDeletePlannerInput,
): ChemicalHoldingDeleteImpact {
  const { holding } = input
  const ownedVersionIds = unique([
    ...input.versions
      .filter(version => version.sourceHoldingId === holding.id)
      .map(version => version.id),
    ...input.links
      .filter(link => link.holdingId === holding.id && link.sdsVersionId !== null)
      .map(link => link.sdsVersionId as string),
  ])
  const targetPublications = input.publications.filter(publication => publication.sourceHoldingId === holding.id)
  const targetLinks = input.links.filter(link => link.holdingId === holding.id)
  const targetDepartmentSdsIds = unique(targetLinks.map(link => link.departmentSdsId))
  const targetPublicationVersionIds = unique(targetPublications.map(publication => publication.sdsVersionId))
  const candidateVersionIds = unique([...ownedVersionIds, ...targetPublicationVersionIds])
  const candidateVersions = input.versions.filter(version => candidateVersionIds.includes(version.id))

  const sharedDependencies: ChemicalHoldingDeleteDependency[] = []
  for (const versionId of candidateVersionIds) {
    const version = input.versions.find(item => item.id === versionId)
    if (!version) continue

    if (version.sourceHoldingId && version.sourceHoldingId !== holding.id) {
      sharedDependencies.push({
        kind: 'version',
        sdsVersionId: version.id,
        relatedHoldingId: version.sourceHoldingId,
        relatedHoldingLabel: input.holdingLabels?.[version.sourceHoldingId] ?? version.sourceHoldingId,
        relatedRowId: version.id,
        destination: null,
        departmentCode: null,
        label: `SDS version ${version.id} เป็นของรายการทะเบียน ${input.holdingLabels?.[version.sourceHoldingId] ?? version.sourceHoldingId}`,
      })
    }

    for (const link of input.links) {
      if (link.sdsVersionId !== versionId || link.holdingId === holding.id) continue
      sharedDependencies.push({
        kind: 'department_link',
        sdsVersionId: versionId,
        relatedHoldingId: link.holdingId,
        relatedHoldingLabel: input.holdingLabels?.[link.holdingId] ?? link.holdingId,
        relatedRowId: link.id,
        destination: 'department',
        departmentCode: input.departmentSds.find(item => item.id === link.departmentSdsId)?.departmentCode ?? null,
        label: `SDS งาน ${link.departmentSdsId} ใช้ร่วมกับรายการทะเบียน ${input.holdingLabels?.[link.holdingId] ?? link.holdingId}`,
      })
    }

    for (const publication of input.publications) {
      if (publication.sdsVersionId !== versionId || publication.sourceHoldingId === holding.id) continue
      sharedDependencies.push({
        kind: 'publication',
        sdsVersionId: versionId,
        relatedHoldingId: publication.sourceHoldingId,
        relatedHoldingLabel: input.holdingLabels?.[publication.sourceHoldingId] ?? publication.sourceHoldingId,
        relatedRowId: publication.id,
        destination: publication.destination,
        departmentCode: publication.departmentCode,
        label: `${publication.displayName} ใช้ SDS ร่วมกับรายการทะเบียน ${input.holdingLabels?.[publication.sourceHoldingId] ?? publication.sourceHoldingId}`,
      })
    }
  }

  const canDelete = sharedDependencies.length === 0
  const legacyPublicationOnlyVersionIds = candidateVersions
    .filter(version => !ownedVersionIds.includes(version.id) && version.sourceHoldingId === null)
    .map(version => version.id)
  const plannedVersionIds = canDelete ? unique([...ownedVersionIds, ...legacyPublicationOnlyVersionIds]) : []
  const plannedDepartmentLinkIds = canDelete ? targetLinks.map(link => link.id) : []
  const plannedDepartmentSdsIds = canDelete ? targetDepartmentSdsIds : []
  const plannedPublicationIds = canDelete ? targetPublications.map(publication => publication.id) : []

  const plannedFileIds = unique([
    ...input.versions
      .filter(version => plannedVersionIds.includes(version.id) && version.fileId !== null)
      .map(version => version.fileId as string),
    ...input.departmentSds
      .filter(item => plannedDepartmentSdsIds.includes(item.id))
      .map(item => item.fileId),
  ])
  const plannedFileRows = input.files.filter(file => plannedFileIds.includes(file.id))
  const remainingVersionRefs = input.versions.filter(version => !plannedVersionIds.includes(version.id))
  const remainingDepartmentSdsRefs = input.departmentSds.filter(item => !plannedDepartmentSdsIds.includes(item.id))

  const filesToDelete: ChemicalHoldingDeleteFileSummary[] = []
  const filesToKeep: ChemicalHoldingDeleteFileSummary[] = []
  for (const file of plannedFileRows) {
    const usedByVersion = remainingVersionRefs.some(version => version.fileId === file.id)
    const usedByDepartmentSds = remainingDepartmentSdsRefs.some(item => item.fileId === file.id)
    if (!usedByVersion && !usedByDepartmentSds) {
      filesToDelete.push(fileSummary(file))
      continue
    }

    const reasons = [
      usedByVersion ? 'อ้างอิงโดย SDS รายการอื่น' : null,
      usedByDepartmentSds ? 'อ้างอิงโดย SDS งานรายการอื่น' : null,
    ].filter((reason): reason is string => reason !== null)
    filesToKeep.push(fileSummary(file, reasons.join(' และ ')))
  }

  const productsPreserved = unique([
    holding.productId,
    ...input.versions.map(version => version.productId),
    ...input.links.map(link => link.productId),
    ...input.publications.flatMap(publication => publication.productId ? [publication.productId] : []),
  ])
  const holdingsPreserved = unique([
    holding.id,
    ...input.versions.flatMap(version => version.sourceHoldingId ? [version.sourceHoldingId] : []),
    ...input.links.map(link => link.holdingId),
    ...input.publications.map(publication => publication.sourceHoldingId),
  ])

  return {
    holdingId: holding.id,
    productId: holding.productId,
    unitId: holding.unitId,
    productName: input.product?.canonicalName ?? holding.productId,
    unitName: input.unit?.nameTh ?? holding.unitId,
    canDelete,
    versions: candidateVersions.map(version => ({
      id: version.id,
      status: version.status,
      revisionLabel: version.revisionLabel,
      fileId: version.fileId,
      willDelete: plannedVersionIds.includes(version.id),
    })),
    publications: targetPublications.map(publication => ({
      id: publication.id,
      sdsVersionId: publication.sdsVersionId,
      sourceHoldingId: publication.sourceHoldingId,
      destination: publication.destination,
      departmentCode: publication.departmentCode,
      displayName: publication.displayName,
      status: publication.status,
    })),
    departmentLinks: targetLinks.map(link => ({
      id: link.id,
      departmentSdsId: link.departmentSdsId,
      sdsVersionId: link.sdsVersionId,
    })),
    departmentSds: input.departmentSds
      .filter(item => targetDepartmentSdsIds.includes(item.id))
      .map(item => ({
        id: item.id,
        departmentCode: item.departmentCode,
        displayName: item.displayName,
        fileId: item.fileId,
        willDelete: plannedDepartmentSdsIds.includes(item.id),
      })),
    sharedDependencies,
    filesToDelete,
    filesToKeep,
    deletePlan: {
      publicationIds: plannedPublicationIds,
      departmentLinkIds: plannedDepartmentLinkIds,
      departmentSdsIds: plannedDepartmentSdsIds,
      sdsVersionIds: plannedVersionIds,
      fileIds: filesToDelete.map(file => file.id),
      fileKeys: filesToDelete.map(file => file.r2Key),
    },
    productIdsPreserved: productsPreserved,
    holdingIdsPreserved: holdingsPreserved,
  }
}
