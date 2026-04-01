export interface iobObject {
    type: string,
    common: {
        name: string,
        role: string,
        type: string,
        unit?: string,
        read: boolean,
        write: boolean,
        desc?: string
    },
    native?: { id: string }
}



