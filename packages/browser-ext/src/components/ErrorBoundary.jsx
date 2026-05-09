import { Component } from 'preact';

export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                    <div className="text-[14px] font-medium text-primary mb-1">Something went wrong</div>
                    <p className="text-[12px] text-tertiary mb-4">An unexpected error occurred in this view.</p>
                    <button
                        type="button"
                        onClick={() => this.setState({ hasError: false })}
                        className="text-[12px] font-medium px-4 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover cursor-pointer transition-colors"
                    >
                        Try again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
