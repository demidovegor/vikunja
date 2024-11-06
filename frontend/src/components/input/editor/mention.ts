import {VueRenderer} from '@tiptap/vue-3'
import tippy from 'tippy.js'
import UserService from '@/services/user'
import type {IUser} from '@/modelTypes/IUser'

import MentionList from './MentionList.vue'

export default function mentionSuggestionSetup() {

	const userService = new UserService()

	return {
		items: async ({query}: { query: string }) => {

			if (query === '') {
				return []
			}

			const response = await userService.getAll({}, {s: query}) as IUser[]


			return response.filter(item => item.username.toLowerCase().startsWith(query.toLowerCase()))
		},

		render: () => {
			let component: VueRenderer
			let popup

			return {
				onStart: props => {

					component = new VueRenderer(MentionList, {
						props,
						editor: props.editor,
					})

					if (!props.clientRect) {
						return
					}

					popup = tippy('body', {
						getReferenceClientRect: props.clientRect,
						appendTo: () => document.body,
						content: component.element,
						showOnCreate: true,
						interactive: true,
						trigger: 'manual',
						placement: 'bottom-start',
					})
				},

				onUpdate(props) {
					component.updateProps(props)

					if (!props.clientRect) {
						return
					}

					popup[0].setProps({
						getReferenceClientRect: props.clientRect,
					})
				},

				onKeyDown(props) {
					if (props.event.key === 'Escape') {
						popup[0].hide()

						return true
					}

					return component.ref?.onKeyDown(props)
				},

				onExit() {
					popup[0].destroy()
					component.destroy()
				},
			}
		},
	}
}