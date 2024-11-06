<template>
	<div class="items">
		<template v-if="items.length">
			<button
				v-for="(item, index) in items"
				:key="index"
				class="item"
				:class="{ 'is-selected': index === selectedIndex }"
				@click="selectItem(index)"
			>
				<p class="username">
					@{{ item.username }}
				</p>
				<p class="name">
					{{ item.name }}
				</p>
			</button>
		</template>
		<div
			v-else
			class="item"
		>
		</div>
	</div>
</template>

<script lang="ts">
/* eslint-disable vue/component-api-style */

export default {

	props: {
		items: {
			type: Array,
			required: true,
		},

		editor: {
			type: Object,
			required: true,
		},

		command: {
			type: Function,
			required: true,
		},
	},

	data() {
		return {
			selectedIndex: 0,
		}
	},

	watch: {
		items() {
			this.selectedIndex = 0
		},
	},

	methods: {
		onKeyDown({event}) {
			if (event.key === 'ArrowUp') {
				this.upHandler()
				return true
			}

			if (event.key === 'ArrowDown') {
				this.downHandler()
				return true
			}

			if (event.key === 'Enter') {
				this.enterHandler()
				return true
			}

			return false
		},

		upHandler() {
			this.selectedIndex = ((this.selectedIndex + this.items.length) - 1) % this.items.length
		},

		downHandler() {
			this.selectedIndex = (this.selectedIndex + 1) % this.items.length
		},

		enterHandler() {
			this.selectItem(this.selectedIndex)
		},

		selectItem(index) {
			const item = this.items[index]
			this.command({id: item.username})
		},
	},
}
</script>

<style lang="scss" scoped>
.items {
	padding: 0.2rem;
	position: relative;
	border-radius: 0.5rem;
	background: var(--white);
	color: var(--grey-900);
	overflow: hidden;
	font-size: 0.9rem;
	box-shadow: var(--shadow-md);
}

.item {
	
	align-items: center;
	margin: 0;
	width: 100%;
	text-align: left;
	background: transparent;
	border-radius: $radius;
	border: 0;
	padding: 0.2rem 0.4rem;
	transition: background-color $transition;

	&.is-selected, &:hover {
		background: var(--grey-100);
		cursor: pointer;
	}
	
}

.item .name {
	font-size: .8rem;
	color: var(--grey-600);
}

.item p {
	
	font-size: .9rem;
	color: var(--grey-800);
	

}
</style>