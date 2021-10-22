class Node {
    constructor(value)
    {
        this.value = value;
        // eslint-disable-next-line no-undefined
        this.next = undefined;
    }
}

export default class Queue {
    constructor()
    {
        this.clear();}

    get size()
    {
        return this._size;
    }

    enqueue(value)
    {
        const node = new Node(value);

        if (this._head) {
            this._tail.next = node;
            this._tail = node;
        } else {
            this._head = node;
            this._tail = node;
        }

        // eslint-disable-next-line no-plusplus
        this._size++;
    }

    dequeue()
    {
        const current = this._head;
        if (!current) {
            return;
        }

        this._head = this._head.next;
        // eslint-disable-next-line no-plusplus
        this._size--;
        // eslint-disable-next-line consistent-return
        return current.value;
    }

    clear()
    {
        // eslint-disable-next-line no-undefined
        this._head = undefined;
        // eslint-disable-next-line no-undefined
        this._tail = undefined;
        this._size = 0;
    }

    * [Symbol.iterator]() {
        let current = this._head;

        while (current) {
            yield current.value;
            current = current.next;
        }
    }
}
