export class InvalidInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidInputError";
    }
}

export function validateTag(key: string, value: string){
    const allowedChars = "^([\\p{L}\\p{Z}\\p{N}_.:/=+\\-@]*)$"; // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Tag.html; also using cfn-lint as a baseline
    // The set of allowed characters varies by service, from basically any character to a strict set of English alphanumeric characters and a few symbols
    const allowedCharsText = "The string can only contain Unicode letters, digits, whitespace, and the characters _.:/=+\-@";
    const allowedRegex = new RegExp(allowedChars, "mu");

    if (!allowedRegex.test(key)){
        throw new InvalidInputError(`Invalid tag key: "${key}". ${allowedCharsText}`)
    } else if (key.toLowerCase().startsWith("aws:")) {
        throw new InvalidInputError(`Invalid tag key "${key}". Tag keys cannot start with "aws:".`)
    } else if (!allowedRegex.test(value)){
        throw new InvalidInputError(`Invalid tag value: "${value}". ${allowedCharsText}`)
    } else {
        return true
    }
}

