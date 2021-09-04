import WS from 'ws';

const connect = wsUrl => new Promise(resolve => {
    const wsConn = new WS(wsUrl);
    if (wsConn.readyState === WS.OPEN) return resolve(wsConn);
    wsConn.once('open', () => resolve(wsConn));
});

export type Context = {
    wsConn: WS;
    messageHandlers: Map<number, () => void>;
    uid: number;
};

export const newContext = (wsUrl: string): Promise<Context> => connect(wsUrl)
    .then(wsConn => {
        const messageHandlers = new Map();

        wsConn.on('message', e => {
            const data = JSON.parse(e);
            if (data.id !== undefined) messageHandlers.get(data.id)(data);
            else console.error(data); // todo, protocol events
        });

        wsConn.on('error', e => console.error('wsConn error', e)); // todo, errors
        wsConn.on('close', e => console.error('wsConn closed', e)); // todo, closing

        return {
            wsConn,
            messageHandlers,
            uid: 0
        };
    });

export const closeContext = (context: Context): void => {
    context.wsConn.close();
};

export const send = (method: string, params: unknown, context: Context): Promise => new Promise(resolve => {
    const { messageHandlers, wsConn } = context;
    const msgId = context.uid++;

    messageHandlers.set(msgId, data => {
        messageHandlers.delete(msgId);
        resolve(data);
    });

    const message = JSON.stringify({
        id: msgId,
        method,
        params
    });

    wsConn.send(message);
});

export const getVersion = (context: Context): Promise => send('Browser.getVersion', null, context);
export const getTargets = (context: Context): Promise => send('Target.getTargets', null, context);

