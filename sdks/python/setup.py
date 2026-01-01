from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="toonstore-torm",
    version="0.1.0",
    author="ToonStore Team",
    author_email="info@toonstore.dev",
    description="ToonStore ORM Client for Python",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/toonstore/torm",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Database",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.31.0",
    ],
    keywords="toonstore orm database redis toon",
    project_urls={
        "Bug Reports": "https://github.com/toonstore/torm/issues",
        "Source": "https://github.com/toonstore/torm",
    },
)
