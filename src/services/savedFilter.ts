import {computed, ref, shallowReactive, unref, watch} from 'vue'
import {useRouter} from 'vue-router'
import {useI18n} from 'vue-i18n'
import type {MaybeRef} from '@vueuse/core'
import {useDebounceFn} from '@vueuse/core'

import type {IProject} from '@/modelTypes/IProject'
import type {ISavedFilter} from '@/modelTypes/ISavedFilter'

import AbstractService from '@/services/abstractService'

import SavedFilterModel from '@/models/savedFilter'

import {useBaseStore} from '@/stores/base'
import {useNamespaceStore} from '@/stores/namespaces'

import {objectToSnakeCase, objectToCamelCase} from '@/helpers/case'
import {success} from '@/message'
import ProjectModel from '@/models/project'

/**
* Calculates the corresponding project id to this saved filter.
* This function matches the one in the api.
*/
function getProjectId(savedFilter: ISavedFilter) {
	let projectId = savedFilter.id * -1 - 1
	if (projectId > 0) {
		projectId = 0
	}
	return projectId
}

export function getSavedFilterIdFromProjectId(projectId: IProject['id']) {
	let filterId = projectId * -1 - 1
	// FilterIds from projectIds are always positive
	if (filterId < 0) {
		filterId = 0
	}
	return filterId
}

export function isSavedFilter(project: IProject) {
	return getSavedFilterIdFromProjectId(project.id) > 0
}

export default class SavedFilterService extends AbstractService<ISavedFilter> {
	constructor() {
		super({
			get: '/filters/{id}',
			create: '/filters',
			update: '/filters/{id}',
			delete: '/filters/{id}',
		})
	}

	modelFactory(data) {
		return new SavedFilterModel(data)
	}

	processModel(model) {
		// Make filters from this.filters camelCase and set them to the model property:
		// That's easier than making the whole filter component configurable since that still needs to provide
		// the filter values in snake_sćase for url parameters.
		model.filters = objectToCamelCase(model.filters)

		// Make sure all filterValues are passes as strings. This is a requirement of the api.
		model.filters.filterValue = model.filters.filterValue.map(v => String(v))

		return model
	}

	beforeUpdate(model) {
		return this.processModel(model)
	}

	beforeCreate(model) {
		return this.processModel(model)
	}
}

export function useSavedFilter(projectId?: MaybeRef<IProject['id']>) {
	const router = useRouter()
	const {t} = useI18n({useScope:'global'})
	const namespaceStore = useNamespaceStore()

	const filterService = shallowReactive(new SavedFilterService())

	const filter = ref<ISavedFilter>(new SavedFilterModel())
	const filters = computed({
		get: () => filter.value.filters,
		set(value) {
			filter.value.filters = value
		},
	})

	// load SavedFilter
	watch(() => unref(projectId), async (watchedProjectId) => {
		if (watchedProjectId === undefined) {
			return
		}

		// We assume the projectId in the route is the pseudoproject
		const savedFilterId = getSavedFilterIdFromProjectId(watchedProjectId)

		filter.value = new SavedFilterModel({id: savedFilterId})
		const response = await filterService.get(filter.value)
		response.filters = objectToSnakeCase(response.filters)
		filter.value = response
	}, {immediate: true})

	async function createFilter() {
		filter.value = await filterService.create(filter.value)
		await namespaceStore.loadNamespaces()
		router.push({name: 'project.index', params: {projectId: getProjectId(filter.value)}})
	}

	async function saveFilter() {
		const response = await filterService.update(filter.value)
		await namespaceStore.loadNamespaces()
		success({message: t('filters.edit.success')})
		response.filters = objectToSnakeCase(response.filters)
		filter.value = response
		await useBaseStore().setCurrentProject(new ProjectModel({
			id: getProjectId(filter.value),
			title: filter.value.title,
		}))
		router.back()
	}

	async function deleteFilter() {	
		await filterService.delete(filter.value)
		await namespaceStore.loadNamespaces()
		success({message: t('filters.delete.success')})
		router.push({name: 'namespaces.index'})
	}

	const titleValid = ref(true)
	const validateTitleField = useDebounceFn(() => {
		titleValid.value = filter.value.title !== ''
	}, 100)

	async function createFilterWithValidation() {
		if (!titleValid.value) {
			return
		}
		return createFilter()
	}
	
	async function saveFilterWithValidation() {
		if (!titleValid.value) {
			return
		}
		return saveFilter()
	}

	return {
		createFilter,
		createFilterWithValidation,
		saveFilter,
		saveFilterWithValidation,
		deleteFilter,

		filter,
		filters,

		filterService,
		
		titleValid,
		validateTitleField,
	}
}