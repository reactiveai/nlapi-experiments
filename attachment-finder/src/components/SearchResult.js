import _ from 'lodash'
import axios from 'axios'
import React from 'react'
import EventEmitterMixin from 'react-event-emitter-mixin'
import SearchResultItem from './SearchResultItem'
import NoResult from './NoResult'

import {QUERY_CONV_ENDPOINT} from '../config'
import {getToken, GMAIL_API_ENDPOINT} from '../common_utils'
const GMAIL_MAX_RESULT = 100

const convertNL2Query = (text) => {
  return new Promise((resolve, reject) => {
    axios.get(QUERY_CONV_ENDPOINT, {
      params: {q: text}
    })
    .then((res) => resolve(res.data))
    .catch((res) => reject(res.data))
  })
}

const gmailMessageList = (query) => {
  return new Promise((resolve, reject) => {
    getToken()
    .then((token) => {
      return axios.get(`${GMAIL_API_ENDPOINT}/me/messages`, {
        params: {
          q: query,
          access_token: token,
          maxResults: GMAIL_MAX_RESULT
        }
      })
    })
    .then((res) => { resolve(res.data) })
    .catch(reject)
  })
}

const getMessage = (id) => {
  return new Promise((resolve, reject) => {
    getToken()
    .then((token) => {
      return axios.get(`${GMAIL_API_ENDPOINT}/me/messages/${id}`, {
        params: {
          access_token: token,
          maxResults: GMAIL_MAX_RESULT
        }
      })
    })
    .then((res) => { resolve(res.data) })
    .catch(reject)
  })
}

module.exports = React.createClass({
  mixins: [EventEmitterMixin],

  searchResultItems() {
    return this.state.messages.map((message) =>
      <SearchResultItem key={message.id} message={message} />
    )
  },

  getInitialState() {
    return {
      messages: []
    }
  },

  componentWillMount() {
    this.eventEmitter('on', 'recognitionInitiated', (text) => {
      this.setState({messages: []})
    })

    this.eventEmitter('on', 'recognitionFinished', (text) => {
      let gmailQuery = null

      convertNL2Query(text)
      .then((res) => {
        gmailQuery = _.trim(res.query)
        console.log(`actual query : ${gmailQuery}`)
        return gmailMessageList(gmailQuery)
      })
      .then((messageList) => {
        console.log(messageList)
        if(messageList.resultSizeEstimate == 0) {
          this.eventEmitter('emit', 'searchingFinished', {query: gmailQuery})
          this.setState({messages: null})
          return
        }

        const messagePromises = messageList.messages.map((message) => getMessage(message.id))
        Promise.all(messagePromises)
        .then((messages) => {
          this.setState({messages})
          this.eventEmitter('emit', 'searchingFinished', null)
        })
      })
      .catch((err) => {
        this.eventEmitter('emit', 'searchingFinished', null)
        console.error(err)
      })
    })
  },

  render() {
    if(_.isNull(this.state.messages)) { return <NoResult /> }
    return <div>
      {this.searchResultItems()}
    </div>
  }
})
