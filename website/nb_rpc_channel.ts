
export type RpcHandler = (...args: any[]) => any;
export type RpcHandlers = { [name: string]: RpcHandler };

interface Message {
  type: "syn" | "ack" | "call" | "return";
}

interface CallMessage extends Message {
  type: "call";
  id: string;
  handler: string;
  args: any[];
}

interface ReturnMessage extends Message {
  type: "return";
  id: string;
  result?: any;
  exception?: any;
}

interface Resolver<T> extends Promise<T> {
  resolve: (value?: T) => void;
  reject: (value: any) => void;
}

function createResolver<T>(): Resolver<T> {
  let methods;
  const promise = new Promise((...args) => { methods = args; }) as Resolver<T>;
  [promise.resolve, promise.reject] = methods;
  return promise;
}

export class RpcChannel {
  private ready = createResolver<void>();
  private readonly unique = Math.random();
  private counter = 0;
  private returnHandlers = new Map<string, Resolver<any>>();

  constructor(private remote: Window, private handlers: RpcHandlers) {
    window.addEventListener("message", event => this.onMessage(event));
    this.remote.postMessage({type: "syn"}, "*");
  }

  async call(handler: string, ...args: any[]): Promise<any> {
    console.log("call", typeof xxx, handler);
    await this.ready;
    console.log("ready", typeof xxx, handler);

    const id = `${this.unique}_${this.counter++}`;
    const message: CallMessage = {
      type: "call",
      id,
      handler,
      args
    };

    const resolver = createResolver<any>();
    this.returnHandlers.set(id, resolver);

    try {
      this.remote.postMessage(message, "*");
      return await resolver;
    } finally {
      this.returnHandlers.delete(id);
    }
  }

  private onMessage(event: MessageEvent): void {
    console.log(typeof xxx, event, event.data);
    const {type} = event.data;
    switch (type) {
      case "syn":
      case "ack":
        this.onHandshake(event);
        break;
      case "call":
        this.onCall(event);
        break;
      case "return":
        this.onReturn(event);
        break;
    }
  }

  private onHandshake(event: MessageEvent) {
    const {type} = event.data;
    if (type === "syn") {
      this.remote.postMessage({ type: "ack" }, "*");
    }
    this.ready.resolve();
  }

  private async onCall(event: MessageEvent) {
    const {id, handler, args} = event.data;
    const ret: ReturnMessage = {
      type: "return",
      id
    };
    try {
      const result = await this.handlers[handler](...args);
      this.remote.postMessage({ result, ...ret }, "*");
    } catch (exception) {
      if (exception instanceof Error) {
        // Convert to a normal object.
        const { message, stack } = exception;
        exception = { message, stack, __error__: true };
      }
      this.remote.postMessage({ exception, ...ret }, "*");
    }
  }

  private onReturn(event: MessageEvent) {
    const message: ReturnMessage = event.data;
    const id = message.id;
    const resolver = this.returnHandlers.get(id);
    if (resolver === undefined) {
        return; // Not for us.
    }
    if (message.hasOwnProperty("exception")) {
      let { exception } = message;
      if (exception.__error__) {
        // Convert to Error object.
        exception = Object.assign(new Error(exception.message),
                                  { stack: exception.stack });
      }
      resolver.reject(exception);
    } else {
      resolver.resolve(message.result);
    }
  }
}
