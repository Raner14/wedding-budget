import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import App from '../App.jsx'

/** Renders the whole app at a given URL path, as BrowserRouter would in production. */
export function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}
