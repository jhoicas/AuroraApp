import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { apiUrl, errorResponse, server } from '../../test/server';
import { renderWithProviders } from '../../test/renderWithProviders';
import { useAuroraCopilotStore } from '../../store/auroraCopilotStore';
import { useCatalogStore } from '../../store/catalogStore';
import AuroraCopilot from './AuroraCopilot';

const chatReply = (overrides: Record<string, unknown> = {}) => ({
  reply: 'Para acueducto rural revisa el producto 4001001.',
  action_cards: [],
  model: 'claude-haiku-4-5-20251001',
  session_id: 'session-abc',
  user_message_id: 'user-1',
  assistant_message_id: 'assistant-1',
  ...overrides,
});

const EMPTY_HINT =
  'Pregúntame sobre formulación MGA, clasificación programática o el conocimiento del grafo.';

/** Abre el panel antes de renderizar para no depender del botón flotante. */
function openCopilot(): void {
  useAuroraCopilotStore.setState({ isOpen: true });
}

describe('Aurora Asistente (FloatingAssistant)', () => {
  beforeEach(() => {
    useAuroraCopilotStore.setState({
      isOpen: false,
      messages: [],
      isTyping: false,
      error: null,
      sessionId: null,
      abortController: null,
      draftInput: '',
    });
    useCatalogStore.setState({ copilotSearch: null });
  });

  it('muestra el botón flotante cuando está cerrado y abre el panel al hacer clic', async () => {
    const { user } = renderWithProviders(<AuroraCopilot />);

    await user.click(screen.getByRole('button', { name: 'Abrir Aurora Asistente' }));

    expect(await screen.findByRole('dialog', { name: 'Aurora Asistente' })).toBeInTheDocument();
    expect(screen.getByText(EMPTY_HINT)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Aurora Asistente' })).toBeInTheDocument();
  });

  it('envía el mensaje escrito, limpia el input y muestra "Aurora está escribiendo…"', async () => {
    let resolveReply: (() => void) | undefined;
    const replySent = new Promise<void>((resolve) => {
      resolveReply = resolve;
    });

    server.use(
      http.post(apiUrl('/ai/aurora/chat'), async () => {
        await replySent;
        return HttpResponse.json(chatReply());
      }),
    );

    openCopilot();
    const { user } = renderWithProviders(<AuroraCopilot />, { route: '/tenant/projects' });

    const input = screen.getByPlaceholderText('Pregunta a Aurora…');
    await user.type(input, '¿Qué producto DNP aplica a acueducto rural?');
    expect(input).toHaveValue('¿Qué producto DNP aplica a acueducto rural?');

    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(input).toHaveValue('');
    expect(await screen.findByText('Aurora está escribiendo…')).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Detener' })).toBeInTheDocument();
    expect(
      screen.getByText('¿Qué producto DNP aplica a acueducto rural?'),
    ).toBeInTheDocument();

    resolveReply?.();

    expect(
      await screen.findByText('Para acueducto rural revisa el producto 4001001.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Aurora está escribiendo…')).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/^Sesión:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Claude|Haiku|claude/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
  });

  it('envía el mensaje al presionar Enter y envía la ruta actual como contexto', async () => {
    const bodies: Array<{ message: string; route_context: string }> = [];
    server.use(
      http.post(apiUrl('/ai/aurora/chat'), async ({ request }) => {
        bodies.push((await request.json()) as { message: string; route_context: string });
        return HttpResponse.json(chatReply());
      }),
    );

    openCopilot();
    const { user } = renderWithProviders(<AuroraCopilot />, { route: '/admin/catalogs/edt' });

    await user.type(screen.getByPlaceholderText('Pregunta a Aurora…'), 'Hola Aurora{Enter}');

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      message: 'Hola Aurora',
      route_context: '/admin/catalogs/edt',
    });
  });

  it('no envía nada cuando el input solo contiene espacios', async () => {
    const requests = vi.fn();
    server.use(
      http.post(apiUrl('/ai/aurora/chat'), () => {
        requests();
        return HttpResponse.json(chatReply());
      }),
    );

    openCopilot();
    const { user } = renderWithProviders(<AuroraCopilot />);

    const input = screen.getByPlaceholderText('Pregunta a Aurora…');
    await user.type(input, '   ');

    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();

    await user.type(input, '{Enter}');
    expect(requests).not.toHaveBeenCalled();
    expect(useAuroraCopilotStore.getState().messages).toHaveLength(0);
  });

  it('el botón "Limpiar chat" dispara clearChat y vacía el historial en pantalla', async () => {
    const clearChatSpy = vi.spyOn(useAuroraCopilotStore.getState(), 'clearChat');

    useAuroraCopilotStore.setState({
      isOpen: true,
      sessionId: 'session-abc',
      messages: [
        { id: 'u1', role: 'user', content: 'Mensaje del usuario' },
        { id: 'a1', role: 'assistant', content: 'Respuesta de Aurora' },
      ],
    });

    const { user } = renderWithProviders(<AuroraCopilot />);
    expect(screen.getByText('Respuesta de Aurora')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpiar chat' }));

    expect(clearChatSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByText('Respuesta de Aurora')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Mensaje del usuario')).not.toBeInTheDocument();
    expect(screen.getByText(EMPTY_HINT)).toBeInTheDocument();
    expect(screen.queryByText(/^Sesión:/)).not.toBeInTheDocument();

    const state = useAuroraCopilotStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.sessionId).toBeNull();
  });

  it('deshabilita "Limpiar chat" mientras no hay historial', () => {
    openCopilot();
    renderWithProviders(<AuroraCopilot />);

    expect(screen.getByRole('button', { name: 'Limpiar chat' })).toBeDisabled();
  });

  it('el botón "Detener" cancela la generación en curso', async () => {
    server.use(
      http.post(apiUrl('/ai/aurora/chat'), async () => {
        await new Promise(() => {});
        return HttpResponse.json(chatReply());
      }),
    );

    openCopilot();
    const { user } = renderWithProviders(<AuroraCopilot />);

    await user.type(screen.getByPlaceholderText('Pregunta a Aurora…'), 'Consulta larga{Enter}');

    const stopButton = await screen.findByRole('button', { name: 'Detener' });
    await user.click(stopButton);

    await waitFor(() => {
      expect(screen.queryByText('Aurora está escribiendo…')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
    expect(useAuroraCopilotStore.getState().abortController).toBeNull();
  });

  it('muestra el error del backend y permite descartarlo', async () => {
    server.use(
      http.post(apiUrl('/ai/aurora/chat'), () => errorResponse(429, 'Demasiadas solicitudes')),
    );

    openCopilot();
    const { user } = renderWithProviders(<AuroraCopilot />);

    await user.type(screen.getByPlaceholderText('Pregunta a Aurora…'), 'Hola{Enter}');

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Demasiadas solicitudes')).toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: 'Cerrar' }));

    await waitFor(() => {
      expect(screen.queryByText('Demasiadas solicitudes')).not.toBeInTheDocument();
    });
  });

  it('cierra el panel al hacer clic en el fondo oscuro', async () => {
    openCopilot();
    const { user } = renderWithProviders(<AuroraCopilot />);

    await user.click(screen.getByRole('button', { name: 'Cerrar panel de Aurora' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Aurora Asistente' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Abrir Aurora Asistente' })).toBeInTheDocument();
  });

  it('renderiza Markdown en respuestas del asistente', async () => {
    server.use(
      http.post(apiUrl('/ai/aurora/chat'), () =>
        HttpResponse.json(
          chatReply({
            reply: '## Título\n\nTexto con **negrita** y lista:\n\n- uno\n- dos',
          }),
        ),
      ),
    );

    openCopilot();
    const { user } = renderWithProviders(<AuroraCopilot />);

    await user.type(screen.getByPlaceholderText('Pregunta a Aurora…'), 'Explica{Enter}');

    expect(await screen.findByRole('heading', { level: 2, name: 'Título' })).toBeInTheDocument();
    expect(screen.getByText('negrita').tagName).toBe('STRONG');
    expect(screen.queryByText(/\*\*negrita\*\*/)).not.toBeInTheDocument();
  });

  describe('Action Cards', () => {
    const actionCard = {
      catalog: 'products',
      code: '4001001',
      label: 'Acueducto rural construido',
      description: 'Producto DNP del sector agua potable.',
    };

    it('desde tenant aplica el filtro y navega al catálogo del formulador', async () => {
      server.use(
        http.post(apiUrl('/ai/aurora/chat'), () =>
          HttpResponse.json(chatReply({ action_cards: [actionCard] })),
        ),
      );

      openCopilot();
      const { user, currentLocation } = renderWithProviders(<AuroraCopilot />, {
        route: '/tenant/projects',
      });

      await user.type(screen.getByPlaceholderText('Pregunta a Aurora…'), 'Acueducto{Enter}');

      expect(await screen.findByText('Acueducto rural construido')).toBeInTheDocument();
      expect(screen.getByText('Producto DNP')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Aplicar' }));

      await waitFor(() => {
        expect(useCatalogStore.getState().copilotSearch).toEqual({
          catalog: 'products',
          query: '4001001',
        });
      });
      expect(currentLocation()).toBe('/tenant/catalog');
      expect(useAuroraCopilotStore.getState().isOpen).toBe(false);
    });

    it('usa el label cuando la Action Card no trae código y no navega si ya estás en la ruta admin', async () => {
      useAuroraCopilotStore.setState({
        isOpen: true,
        messages: [
          {
            id: 'a1',
            role: 'assistant',
            content: 'Te sugiero este sector.',
            actionCards: [{ catalog: 'sectors', code: '', label: 'Transporte' }],
          },
        ],
      });

      const { user, currentLocation } = renderWithProviders(<AuroraCopilot />, {
        route: '/admin/catalogs/sectors',
      });

      await user.click(screen.getByRole('button', { name: 'Aplicar' }));

      await waitFor(() => {
        expect(useCatalogStore.getState().copilotSearch).toEqual({
          catalog: 'sectors',
          query: 'Transporte',
        });
      });
      expect(currentLocation()).toBe('/admin/catalogs/sectors');
    });
  });
});
