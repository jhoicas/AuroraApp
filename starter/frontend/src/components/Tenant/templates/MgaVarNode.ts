import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Nodo inline atómico para variables MGA:
 * <span class="mga-var" data-id="project.name">Nombre del Proyecto</span>
 */
export const MgaVar = Node.create({
  name: 'mgaVar',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-id') ?? '',
        renderHTML: (attrs) => ({ 'data-id': attrs.id }),
      },
      label: {
        default: '',
        parseHTML: (el) => el.textContent ?? '',
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span.mga-var[data-id]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'mga-var' }, HTMLAttributes), node.attrs.label || node.attrs.id];
  },
});
