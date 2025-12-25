import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, ArrowRight } from 'lucide-react';

export function UserOnboardingModal() {
    const { userName, setUserName } = useSettingsStore();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');

    useEffect(() => {
        if (!userName) {
            setOpen(true);
        }
    }, [userName]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            setUserName(name.trim());
            setOpen(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            // Prevent closing if no name set yet
            if (userName) setOpen(val);
        }}>
            <DialogContent className="sm:max-w-md border-none shadow-2xl bg-card/95 backdrop-blur-xl">
                <DialogHeader className="space-y-4 text-center pb-2">
                    <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit ring-1 ring-primary/20">
                        <User className="h-8 w-8 text-primary" />
                    </div>
                    <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                        Welcome to Branching AI
                    </DialogTitle>
                    <DialogDescription className="text-base text-muted-foreground">
                        How should we call you? This format will be used for your conversation nodes.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    <div className="relative">
                        <Input
                            placeholder="Your Name (e.g. Alex)"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-accent/50 border-border/50 h-12 text-lg text-center focus-visible:ring-primary/30"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={!name.trim()}
                            className="w-full h-11 text-base font-medium shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
                        >
                            Start Brainstorming
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
