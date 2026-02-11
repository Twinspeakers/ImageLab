import { openDB } from 'idb'
import type { AssetBlobRecord, Project, RecentProject } from '../types'

interface ImagelabDB {
  projects: {
    key: string
    value: Project
  }
  assets: {
    key: string
    value: AssetBlobRecord
  }
  recents: {
    key: string
    value: RecentProject
  }
}

const dbPromise = openDB<ImagelabDB>('imagelab-db', 1, {
  upgrade(db) {
    db.createObjectStore('projects', { keyPath: 'id' })
    db.createObjectStore('assets', { keyPath: 'id' })
    db.createObjectStore('recents', { keyPath: 'id' })
  },
})

export const putProject = async (project: Project) => {
  const db = await dbPromise
  await db.put('projects', project)
  await db.put('recents', {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    type: project.type,
  })
}

export const renameProject = async (id: string, name: string) => {
  const db = await dbPromise
  const project = await db.get('projects', id)
  if (!project) return null
  const next: Project = {
    ...project,
    name,
    updatedAt: new Date().toISOString(),
  }
  await db.put('projects', next)
  await db.put('recents', {
    id: next.id,
    name: next.name,
    updatedAt: next.updatedAt,
    type: next.type,
  })
  return next
}

export const getProject = async (id: string) => {
  const db = await dbPromise
  return db.get('projects', id)
}

export const getAllProjects = async () => {
  const db = await dbPromise
  return db.getAll('projects')
}

export const getRecentProjects = async () => {
  const db = await dbPromise
  const recents = await db.getAll('recents')
  return recents.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export const putAsset = async (asset: AssetBlobRecord) => {
  const db = await dbPromise
  await db.put('assets', asset)
}

export const getAsset = async (id: string) => {
  const db = await dbPromise
  return db.get('assets', id)
}

export const getAllAssets = async () => {
  const db = await dbPromise
  return db.getAll('assets')
}

export const bulkPutAssets = async (assets: AssetBlobRecord[]) => {
  const db = await dbPromise
  const tx = db.transaction('assets', 'readwrite')
  for (const asset of assets) {
    await tx.store.put(asset)
  }
  await tx.done
}

export const deleteProject = async (id: string) => {
  const db = await dbPromise
  await db.delete('projects', id)
  await db.delete('recents', id)
}
