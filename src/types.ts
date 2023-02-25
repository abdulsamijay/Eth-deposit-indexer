interface eventsReturnType {
    removed: string, 
    blockNumber: string, 
    transactionHash: string, 
    returnValues: string;
}

export interface Types {
    eventsReturnType: eventsReturnType
}

export interface txFromToInterface {
    from: String,
    to: String,
    hash: String,
}