import axios from 'axios'

export const runEngine = () => axios.post('/api/run')
export const getResults = () => axios.get('/api/results')
