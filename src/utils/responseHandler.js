const success = (data, message) => ({
    status: true,
    data,
    message
})

const error = (message) => ({
    status: false,
    message
})

export default {
    success,
    error
}