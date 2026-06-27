from django.core.management.base import BaseCommand
from api.services import rag


class Command(BaseCommand):
    help = "Encode all resumes and save embeddings to PostgreSQL (pgvector)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-index even if embeddings already exist.",
        )

    def handle(self, *args, **options):
        if not options["force"] and rag.embeddings_exist():
            self.stdout.write(
                self.style.WARNING(
                    "Embeddings already exist. Use --force to rebuild."
                )
            )
            return

        rag.build_index()
        self.stdout.write(self.style.SUCCESS("Index built successfully."))
